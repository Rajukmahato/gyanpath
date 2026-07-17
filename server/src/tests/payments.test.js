import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.REDIS_URL = 'redis://localhost:6379/13'
process.env.NODE_ENV = 'test'
// activate the real eSewa path (instead of dev-enroll) for these tests
process.env.ESEWA_SECRET_KEY = '8gBm/:&EnhH.1/q'
process.env.ESEWA_PRODUCT_CODE = 'EPAYTEST'

const ESEWA_SECRET = process.env.ESEWA_SECRET_KEY

let mongod
let server
let baseUrl
let User, Course, Payment, Enrollment

before(async () => {
  // a real replica set is needed here (not the plain MongoMemoryServer used elsewhere)
  // because the verify handler uses a multi-document transaction.
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  await mongoose.connect(mongod.getUri())

  ;({ default: User } = await import('../models/User.js'))
  ;({ default: Course } = await import('../models/Course.js'))
  ;({ default: Payment } = await import('../models/Payment.js'))
  ;({ default: Enrollment } = await import('../models/Enrollment.js'))

  const { getRedis } = await import('../config/redis.js')
  await getRedis().flushdb()

  const { default: app } = await import('../app.js')
  server = app.listen(0)
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(async () => {
  await Promise.all([User, Course, Payment, Enrollment].map((m) => m.deleteMany({})))
})

after(async () => {
  const { getRedis } = await import('../config/redis.js')
  await getRedis().quit()
  await mongoose.connection.close()
  await mongod.stop()
  server.close()
})

const { hashPassword } = await import('../utils/password.js')
const { signAccessToken } = await import('../services/tokenService.js')

async function makeUser(role) {
  const user = await User.create({
    email: `${role}-${Date.now()}-${Math.random()}@test.local`,
    passwordHash: await hashPassword('CorrectHorse9!Battery'),
    role,
    emailVerified: true,
  })
  return { user, token: signAccessToken(user) }
}

async function authed(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

// build the base64 response payload eSewa redirects back with, signed the same way
function buildCallbackData({ transactionUuid, totalAmount, status = 'COMPLETE', tamper = false }) {
  const fields = {
    transaction_code: '000AE01',
    status,
    total_amount: String(totalAmount),
    transaction_uuid: transactionUuid,
    product_code: 'EPAYTEST',
    signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
  }
  const message = fields.signed_field_names.split(',').map((f) => `${f}=${fields[f]}`).join(',')
  fields.signature = crypto.createHmac('sha256', ESEWA_SECRET).update(message).digest('base64')
  if (tamper) fields.total_amount = '1' // change a signed field after signing
  return Buffer.from(JSON.stringify(fields)).toString('base64')
}

async function startCheckout(token, course) {
  const res = await authed(`/api/courses/${course._id}/checkout`, { method: 'POST', token })
  return res
}

// raw request that captures the redirect (status + Location) instead of following it
function rawRequest(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${baseUrl}${path}`)
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: body
          ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
          : {},
      },
      (res) => {
        let d = ''
        res.on('data', (c) => { d += c })
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body: d }))
      },
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

const postCallback = (data) => rawRequest('/api/payments/esewa/callback', { method: 'POST', body: `data=${encodeURIComponent(data)}` })

test('checkout returns an eSewa form with a valid request signature and a pending payment', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Pay Me', priceNPR: 1200, status: 'approved' })

  const res = await startCheckout(token, course)
  assert.equal(res.status, 200)
  assert.ok(res.body.esewa?.url.includes('esewa'))

  const f = res.body.esewa.fields
  assert.equal(f.total_amount, '1200')
  assert.equal(f.product_code, 'EPAYTEST')

  const message = f.signed_field_names.split(',').map((n) => `${n}=${f[n]}`).join(',')
  const expected = crypto.createHmac('sha256', ESEWA_SECRET).update(message).digest('base64')
  assert.equal(f.signature, expected)

  const payment = await Payment.findOne({ userId: student._id, courseId: course._id })
  assert.equal(payment.status, 'pending')
  assert.equal(payment.transactionUuid, f.transaction_uuid)
})

test('a validly-signed COMPLETE callback (POST) enrolls the student and redirects to success', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })

  const checkoutRes = await startCheckout(token, course)
  const transactionUuid = checkoutRes.body.esewa.fields.transaction_uuid

  const res = await postCallback(buildCallbackData({ transactionUuid, totalAmount: 1000 }))
  assert.equal(res.status, 302)
  assert.match(res.location, /status=success/)

  const payment = await Payment.findOne({ transactionUuid })
  assert.equal(payment.status, 'succeeded')
  const enrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id })
  assert.equal(enrollment.status, 'active')
})

test('a GET callback (query data, with base64 + turned to spaces) also settles the payment', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })

  const checkoutRes = await startCheckout(token, course)
  const transactionUuid = checkoutRes.body.esewa.fields.transaction_uuid

  // simulate the browser turning '+' in the base64 into spaces on a GET query param
  const data = buildCallbackData({ transactionUuid, totalAmount: 1000 }).replace(/\+/g, ' ')
  const res = await rawRequest(`/api/payments/esewa/callback?data=${encodeURIComponent(data)}`)
  assert.equal(res.status, 302)
  assert.match(res.location, /status=success/)

  const enrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id })
  assert.equal(enrollment.status, 'active')
})

test('a tampered callback does not enroll and redirects to failed', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })

  const checkoutRes = await startCheckout(token, course)
  const transactionUuid = checkoutRes.body.esewa.fields.transaction_uuid

  const res = await postCallback(buildCallbackData({ transactionUuid, totalAmount: 1000, tamper: true }))
  assert.equal(res.status, 302)
  assert.match(res.location, /status=failed/)

  const enrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id })
  assert.equal(enrollment, null)
})

test('a validly-signed callback for the wrong amount is rejected (amount guard)', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })

  const checkoutRes = await startCheckout(token, course)
  const transactionUuid = checkoutRes.body.esewa.fields.transaction_uuid

  // correctly signed, but for 1 rupee instead of the real price
  const res = await postCallback(buildCallbackData({ transactionUuid, totalAmount: 1 }))
  assert.equal(res.status, 302)
  assert.match(res.location, /status=failed/)
})

test('confirm returns 404 for an unknown transaction (not this user)', async () => {
  const { token } = await makeUser('student')
  const res = await authed('/api/payments/esewa/confirm', { method: 'POST', token, body: { transactionUuid: 'nope-123' } })
  assert.equal(res.status, 404)
})

test('confirm reports an already-succeeded payment as enrolled without re-checking', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  const payment = await Payment.create({
    userId: student._id, courseId: course._id, provider: 'esewa',
    transactionUuid: 'already-done-1', amountNPR: 1000, status: 'succeeded',
  })

  const res = await authed('/api/payments/esewa/confirm', { method: 'POST', token, body: { transactionUuid: payment.transactionUuid } })
  assert.equal(res.status, 200)
  assert.equal(res.body.enrolled, true)
})

test('khalti confirm returns 404 for an unknown pidx', async () => {
  const { token } = await makeUser('student')
  const res = await authed('/api/payments/khalti/confirm', { method: 'POST', token, body: { pidx: 'nope-pidx' } })
  assert.equal(res.status, 404)
})

test('khalti confirm reports an already-succeeded payment as enrolled', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  await Payment.create({
    userId: student._id, courseId: course._id, provider: 'khalti',
    transactionUuid: 'po-done-1', pidx: 'pidx-done-1', amountNPR: 1000, status: 'succeeded',
  })

  const res = await authed('/api/payments/khalti/confirm', { method: 'POST', token, body: { pidx: 'pidx-done-1' } })
  assert.equal(res.status, 200)
  assert.equal(res.body.enrolled, true)
})
