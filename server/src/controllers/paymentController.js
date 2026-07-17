import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import Course from '../models/Course.js'
import Payment from '../models/Payment.js'
import Enrollment from '../models/Enrollment.js'
import {
  isEsewaConfigured,
  buildEsewaPayment,
  decodeEsewaResponse,
  verifyEsewaSignature,
  fetchEsewaStatus,
} from '../services/esewaService.js'
import { isKhaltiConfigured, initiateKhalti, lookupKhalti } from '../services/khaltiService.js'
import { logAction } from '../services/auditService.js'
import { clientOrigin } from '../utils/clientOrigin.js'

function apiBase(req) {
  return process.env.SERVER_ORIGIN || `${req.protocol}://${req.get('host')}`
}

// no gateway configured (local/dev): enroll directly so the product is fully usable
async function devEnroll(req, course) {
  // upsert so re-enrolling after a refund reactivates the existing (refunded) row
  // instead of colliding with the unique (userId, courseId) index
  await Enrollment.findOneAndUpdate(
    { userId: req.user._id, courseId: course._id },
    { $set: { status: 'active' } },
    { upsert: true, setDefaultsOnInsert: true },
  )
  await Payment.create({
    userId: req.user._id,
    courseId: course._id,
    provider: 'dev',
    transactionUuid: `dev_${req.user._id}_${course._id}_${Date.now()}`,
    amountNPR: course.priceNPR,
    status: 'succeeded',
  })
  await logAction({ actor: req.user._id, role: req.user.role, action: 'enroll_dev', resourceType: 'Course', resourceId: course._id, ip: req.ip, status: 'success' })
}

export async function checkout(req, res) {
  const course = await Course.findOne({ _id: req.params.id, status: 'approved' })
  if (!course) return res.status(404).json({ error: 'not found' })

  const existing = await Enrollment.findOne({ userId: req.user._id, courseId: course._id, status: 'active' })
  if (existing) return res.status(409).json({ error: 'already enrolled' })

  const origin = clientOrigin()

  // Khalti is the primary gateway (its sandbox actually settles test payments); eSewa is
  // kept as a spec-correct alternative; with neither configured we dev-enroll instantly.
  if (isKhaltiConfigured()) {
    const purchaseOrderId = uuidv4()
    const payment = await Payment.create({
      userId: req.user._id,
      courseId: course._id,
      provider: 'khalti',
      transactionUuid: purchaseOrderId,
      amountNPR: course.priceNPR,
      status: 'pending',
    })
    const init = await initiateKhalti({
      amountPaisa: course.priceNPR * 100, // Khalti bills in paisa
      purchaseOrderId,
      purchaseOrderName: course.title,
      returnUrl: `${origin}/payment/khalti`,
      websiteUrl: origin,
      customer: { name: req.user.profile?.name || req.user.email, email: req.user.email },
    })
    payment.pidx = init.pidx
    await payment.save()
    return res.json({ khalti: { paymentUrl: init.payment_url, pidx: init.pidx } })
  }

  if (isEsewaConfigured()) {
    // one pending payment per attempt, keyed by a fresh transaction_uuid
    const transactionUuid = uuidv4()
    await Payment.create({
      userId: req.user._id,
      courseId: course._id,
      provider: 'esewa',
      transactionUuid,
      amountNPR: course.priceNPR,
      status: 'pending',
    })
    // eSewa redirects the browser to our server callback (GET or POST) — not the SPA —
    // so the signed response is read server-side regardless of how eSewa delivers it
    const callback = `${apiBase(req)}/api/payments/esewa/callback`
    const esewa = buildEsewaPayment({
      amountNPR: course.priceNPR,
      transactionUuid,
      successUrl: callback,
      failureUrl: callback,
    })
    return res.json({ esewa })
  }

  await devEnroll(req, course)
  res.json({ devEnrolled: true })
}

// Called by the client after Khalti redirects back with the pidx. We look the pidx up
// against Khalti (authoritative) and enroll only on a Completed payment + amount match.
export async function confirmKhaltiPayment(req, res) {
  const { pidx } = req.body
  if (typeof pidx !== 'string') return res.status(400).json({ error: 'pidx required' })

  const payment = await Payment.findOne({ pidx, userId: req.user._id })
  if (!payment) return res.status(404).json({ error: 'payment not found' })
  if (payment.status === 'succeeded') return res.json({ enrolled: true, courseId: payment.courseId })

  const lookup = await lookupKhalti(pidx)
  console.log('[khalti] confirm: pidx=%s -> lookup: %j', pidx, lookup)
  const completed = lookup?.status === 'Completed' && Number(lookup.total_amount) === payment.amountNPR * 100
  if (!completed) {
    return res.json({ enrolled: false, status: lookup?.status || 'UNKNOWN' })
  }

  await activatePaidEnrollment(payment, lookup.transaction_id)
  res.json({ enrolled: true, courseId: payment.courseId })
}

// Verifies eSewa's signed response and activates the enrollment. Identified by the
// signature + the pending payment's stored userId, so it needs no logged-in session.
// mark the payment paid + activate the enrollment, in a transaction (idempotent)
async function activatePaidEnrollment(payment, providerRef) {
  if (payment.status === 'succeeded') return
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      payment.status = 'succeeded'
      payment.providerRef = providerRef
      await payment.save({ session })
      // $set (not $setOnInsert) so a repurchase after a refund reactivates the row
      await Enrollment.findOneAndUpdate(
        { userId: payment.userId, courseId: payment.courseId },
        { $set: { status: 'active' } },
        { upsert: true, setDefaultsOnInsert: true, session },
      )
    })
  } finally {
    await session.endSession()
  }
  await logAction({
    actor: payment.userId,
    action: 'payment_succeeded',
    resourceType: 'Payment',
    resourceId: payment._id,
    status: 'success',
    metadata: { courseId: payment.courseId, provider: 'esewa' },
  })
}

async function settleEsewaPayment(decoded) {
  if (!decoded) { console.warn('[esewa] settle: no decoded payload'); return { ok: false } }
  if (!verifyEsewaSignature(decoded)) { console.warn('[esewa] settle: bad signature; payload=%j', decoded); return { ok: false } }
  if (decoded.status !== 'COMPLETE') { console.warn('[esewa] settle: status=%s (not COMPLETE)', decoded.status); return { ok: false } }

  const payment = await Payment.findOne({ transactionUuid: decoded.transaction_uuid })
  if (!payment) { console.warn('[esewa] settle: no payment for txn=%s', decoded.transaction_uuid); return { ok: false } }

  // a valid signature over a tampered amount is still rejected here
  if (Number(String(decoded.total_amount).replace(/,/g, '')) !== payment.amountNPR) {
    console.warn('[esewa] settle: amount mismatch got=%s expected=%s', decoded.total_amount, payment.amountNPR)
    return { ok: false }
  }

  await activatePaidEnrollment(payment, decoded.transaction_code)
  return { ok: true, courseId: payment.courseId }
}

// eSewa redirects the browser here after payment (as GET ?data or POST form data).
// We try to settle from the signed data, then bounce the browser back to the SPA,
// which also confirms against eSewa's status API (authoritative).
export async function esewaCallback(req, res) {
  // broad capture: dump EVERYTHING eSewa sends so we can see the real response shape
  console.log('[esewa] callback FULL — method=%s url=%s content-type=%s', req.method, req.originalUrl, req.get('content-type') || '(none)')
  console.log('[esewa] callback query=%j', req.query)
  console.log('[esewa] callback body=%j', req.body)

  const raw = req.body?.data || req.query?.data
  const decoded = decodeEsewaResponse(raw)
  if (decoded) console.log('[esewa] callback decoded=%j', decoded)
  const result = await settleEsewaPayment(decoded)
  const origin = clientOrigin()
  // pull a transaction id from wherever eSewa put it (base64 data, or a plain param)
  const txnId = decoded?.transaction_uuid || req.query?.transaction_uuid || req.body?.transaction_uuid
  const txn = txnId ? `&txn=${txnId}` : ''
  if (result.ok) {
    return res.redirect(`${origin}/payment/callback?status=success&course=${result.courseId}`)
  }
  return res.redirect(`${origin}/payment/callback?status=failed${txn}`)
}

// Authoritative confirmation: the client calls this after returning from eSewa. We ask
// eSewa's status API whether the transaction actually completed, and enroll only then —
// so a flaky/absent browser callback can't leave a paid learner un-enrolled, and a
// genuinely failed payment reports its real status instead of a vague error.
export async function confirmEsewaPayment(req, res) {
  const { transactionUuid } = req.body
  if (typeof transactionUuid !== 'string') return res.status(400).json({ error: 'transactionUuid required' })

  const payment = await Payment.findOne({ transactionUuid, userId: req.user._id })
  if (!payment) { console.warn('[esewa] confirm: no payment for txn=%s user=%s', transactionUuid, req.user._id); return res.status(404).json({ error: 'payment not found' }) }
  if (payment.status === 'succeeded') return res.json({ enrolled: true, courseId: payment.courseId })

  const status = await fetchEsewaStatus({ transactionUuid, totalAmount: payment.amountNPR })
  console.log('[esewa] confirm: txn=%s amountNPR=%s -> eSewa status API returned: %j', transactionUuid, payment.amountNPR, status)
  const complete = status?.status === 'COMPLETE'
    && Number(String(status.total_amount).replace(/,/g, '')) === payment.amountNPR
  if (!complete) {
    return res.json({ enrolled: false, status: status?.status || 'UNKNOWN' })
  }

  await activatePaidEnrollment(payment, status.ref_id)
  res.json({ enrolled: true, courseId: payment.courseId })
}
