import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.REDIS_URL = 'redis://localhost:6379/12'
process.env.NODE_ENV = 'test'

let mongod
let server
let baseUrl
let User, Course, Enrollment

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  ;({ default: User } = await import('../models/User.js'))
  ;({ default: Course } = await import('../models/Course.js'))
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

test('instructor can request a payout, student cannot', async () => {
  const { token: instructorToken } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')

  const ok = await authed('/api/payouts', { method: 'POST', token: instructorToken, body: { amountNPR: 5000 } })
  assert.equal(ok.status, 201)

  const blocked = await authed('/api/payouts', { method: 'POST', token: studentToken, body: { amountNPR: 5000 } })
  assert.equal(blocked.status, 403)
})

test('only admin can approve a payout request', async () => {
  const { token: instructorToken } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')
  const { token: adminToken } = await makeUser('admin')

  const created = await authed('/api/payouts', { method: 'POST', token: instructorToken, body: { amountNPR: 5000 } })

  const blocked = await authed(`/api/payouts/${created.body._id}/review`, { method: 'POST', token: studentToken, body: { decision: 'approved' } })
  assert.equal(blocked.status, 403)

  const approved = await authed(`/api/payouts/${created.body._id}/review`, { method: 'POST', token: adminToken, body: { decision: 'approved' } })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.status, 'approved')
})

test('refund is rejected once too much of the course has been watched', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token: studentToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  const { default: Lesson } = await import('../models/Lesson.js')
  const lessons = await Lesson.insertMany([
    { courseId: course._id, title: 'L1', order: 1 },
    { courseId: course._id, title: 'L2', order: 2 },
  ])

  const enrollment = await Enrollment.create({
    userId: student._id,
    courseId: course._id,
    progress: [{ lessonId: lessons[0]._id, completed: true }],
  })

  const res = await authed(`/api/enrollments/${enrollment._id}/refund-request`, { method: 'POST', token: studentToken })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /too much/)
})

test('refund is rejected outside the refund window', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token: studentToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
  const enrollment = await Enrollment.create({ userId: student._id, courseId: course._id, purchasedAt: eightDaysAgo })

  const res = await authed(`/api/enrollments/${enrollment._id}/refund-request`, { method: 'POST', token: studentToken })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /window/)
})

test('refund request for someone else\'s enrollment is not found, not leaked', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: owner } = await makeUser('student')
  const { token: attackerToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Course', priceNPR: 1000, status: 'approved' })
  const enrollment = await Enrollment.create({ userId: owner._id, courseId: course._id })

  const res = await authed(`/api/enrollments/${enrollment._id}/refund-request`, { method: 'POST', token: attackerToken })
  assert.equal(res.status, 404)
})
