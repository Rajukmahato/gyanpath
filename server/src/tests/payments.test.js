import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import Stripe from 'stripe'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.REDIS_URL = 'redis://localhost:6379/13'
process.env.NODE_ENV = 'test'
process.env.STRIPE_SECRET_KEY = 'sk_test_offline_placeholder'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_offline_placeholder'

let mongod
let server
let baseUrl
let User, Course, Payment, Enrollment

before(async () => {
  // a real replica set is needed here (not the plain MongoMemoryServer used elsewhere)
  // because the webhook handler uses a multi-document transaction.
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

after(async () => {
  const { getRedis } = await import('../config/redis.js')
  await getRedis().quit()
  await mongoose.connection.close()
  await mongod.stop()
  server.close()
})

function signedWebhookRequest(payloadObject) {
  const payload = JSON.stringify(payloadObject)
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  return { payload, header }
}

test('webhook with a valid signature marks payment succeeded and creates an enrollment', async () => {
  const { hashPassword } = await import('../utils/password.js')
  const instructor = await User.create({ email: 'inst@test.local', passwordHash: await hashPassword('x'), role: 'instructor', emailVerified: true })
  const student = await User.create({ email: 'stud@test.local', passwordHash: await hashPassword('x'), role: 'student', emailVerified: true })
  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  const payment = await Payment.create({
    userId: student._id,
    courseId: course._id,
    stripePaymentIntentId: 'pi_test_123',
    amountNPR: 1000,
    status: 'pending',
  })

  const { payload, header } = signedWebhookRequest({
    id: 'evt_test_1',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test_123' } },
  })

  const res = await fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
    body: payload,
  })
  assert.equal(res.status, 200)

  const updatedPayment = await Payment.findById(payment._id)
  assert.equal(updatedPayment.status, 'succeeded')

  const enrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id })
  assert.ok(enrollment)
  assert.equal(enrollment.status, 'active')
})

test('webhook with an invalid signature is rejected and changes nothing', async () => {
  const payload = JSON.stringify({ id: 'evt_bad', type: 'payment_intent.succeeded', data: { object: { id: 'pi_does_not_exist' } } })

  const res = await fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: payload,
  })
  assert.equal(res.status, 400)
})
