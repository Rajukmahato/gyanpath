import PayoutRequest from '../models/PayoutRequest.js'
import { logAction } from '../services/auditService.js'

export async function requestPayout(req, res) {
  const { amountNPR } = req.body
  if (!amountNPR || amountNPR <= 0) return res.status(400).json({ error: 'amountNPR must be positive' })

  const payout = await PayoutRequest.create({ instructorId: req.user._id, amountNPR })
  res.status(201).json(payout)
}

export async function listMyPayouts(req, res) {
  const payouts = await PayoutRequest.find({ instructorId: req.user._id }).lean()
  res.json(payouts)
}

export async function listPendingPayouts(req, res) {
  const payouts = await PayoutRequest.find({ status: 'pending' }).populate('instructorId', 'email profile.name').lean()
  res.json(payouts)
}

export async function reviewPayout(req, res) {
  const { decision } = req.body // 'approved' | 'rejected' | 'paid'
  if (!['approved', 'rejected', 'paid'].includes(decision)) {
    return res.status(400).json({ error: 'invalid decision' })
  }

  const payout = await PayoutRequest.findById(req.params.id)
  if (!payout) return res.status(404).json({ error: 'not found' })

  payout.status = decision
  payout.approvedBy = req.user._id
  payout.approvedAt = new Date()
  await payout.save()

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'payout_review',
    resourceType: 'PayoutRequest',
    resourceId: payout._id,
    ip: req.ip,
    status: decision,
  })

  res.json(payout)
}
