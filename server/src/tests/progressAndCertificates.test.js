import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.CERT_SIGNING_SECRET = '0c580398d8cfb8a90e6a2ae6417613045003da9ce3dc03d144dbfc653d785ad5'
process.env.REDIS_URL = 'redis://localhost:6379/11'
process.env.NODE_ENV = 'test'

let mongod
let server
let baseUrl
let User, Course, Lesson, Enrollment, Certificate

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  ;({ default: User } = await import('../models/User.js'))
  ;({ default: Course } = await import('../models/Course.js'))
  ;({ default: Lesson } = await import('../models/Lesson.js'))
  ;({ default: Enrollment } = await import('../models/Enrollment.js'))
  ;({ default: Certificate } = await import('../models/Certificate.js'))

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
    profile: { name: `${role} person` },
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

test('a non-enrolled user cannot record progress on a lesson (forgery resistance)', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token: outsiderToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'C', priceNPR: 500, status: 'approved' })
  const lesson = await Lesson.create({ courseId: course._id, title: 'L1', order: 1, durationSec: 100 })

  const res = await authed(`/api/progress/${lesson._id}/ping`, { method: 'POST', token: outsiderToken, body: { watchedSecondsDelta: 50 } })
  assert.equal(res.status, 403)
})

test('completing every lesson via pings auto-issues a signed certificate', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token: studentToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Full Course', priceNPR: 500, status: 'approved' })
  const lessons = await Lesson.insertMany([
    { courseId: course._id, title: 'L1', order: 1, durationSec: 100 },
    { courseId: course._id, title: 'L2', order: 2, durationSec: 100 },
  ])
  await Enrollment.create({ userId: student._id, courseId: course._id, status: 'active' })

  // first lesson: ping past the 90% completion threshold
  const ping1 = await authed(`/api/progress/${lessons[0]._id}/ping`, { method: 'POST', token: studentToken, body: { watchedSecondsDelta: 95 } })
  assert.equal(ping1.status, 200)
  assert.equal(ping1.body.completed, true)
  assert.equal(ping1.body.certificateIssued, false)

  // second (final) lesson: this ping should cross 100% course completion and issue a certificate
  const ping2 = await authed(`/api/progress/${lessons[1]._id}/ping`, { method: 'POST', token: studentToken, body: { watchedSecondsDelta: 95 } })
  assert.equal(ping2.status, 200)
  assert.equal(ping2.body.completed, true)
  assert.equal(ping2.body.certificateIssued, true)
  assert.ok(ping2.body.certificateId)

  // pinging again afterwards must not issue a second certificate
  const pingAgain = await authed(`/api/progress/${lessons[1]._id}/ping`, { method: 'POST', token: studentToken, body: { watchedSecondsDelta: 1 } })
  assert.equal(pingAgain.body.certificateIssued, false)

  const certCount = await Certificate.countDocuments({ userId: student._id, courseId: course._id })
  assert.equal(certCount, 1)

  // public verification endpoint confirms it's genuine
  const verifyRes = await fetch(`${baseUrl}/api/certificates/${ping2.body.certificateId}/verify`)
  const verifyBody = await verifyRes.json()
  assert.equal(verifyBody.valid, true)
  assert.equal(verifyBody.studentName, 'student person')
  assert.equal(verifyBody.courseTitle, 'Full Course')
})

test('a tampered certificate signature fails verification', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token: studentToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Short Course', priceNPR: 500, status: 'approved' })
  const lesson = await Lesson.create({ courseId: course._id, title: 'Only lesson', order: 1, durationSec: 60 })
  await Enrollment.create({ userId: student._id, courseId: course._id, status: 'active' })

  const ping = await authed(`/api/progress/${lesson._id}/ping`, { method: 'POST', token: studentToken, body: { watchedSecondsDelta: 60 } })
  assert.equal(ping.body.certificateIssued, true)

  // simulate tampering: directly corrupt the stored signature, as if a forged certificate
  // (or a DB-level attacker) tried to claim a different signature was valid
  await Certificate.updateOne({ certificateId: ping.body.certificateId }, { signature: 'deadbeef'.repeat(8) })

  const verifyRes = await fetch(`${baseUrl}/api/certificates/${ping.body.certificateId}/verify`)
  const verifyBody = await verifyRes.json()
  assert.equal(verifyBody.valid, false)
})

test('verifying a certificate id that does not exist returns not valid, not a crash', async () => {
  const res = await fetch(`${baseUrl}/api/certificates/not-a-real-id/verify`)
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.valid, false)
})

test('profile update cannot smuggle a role change (mass-assignment guard)', async () => {
  const { token } = await makeUser('student')

  const res = await authed('/api/users/me', {
    method: 'PATCH',
    token,
    body: { profile: { name: 'New Name' }, role: 'admin', instructorVerified: true },
  })
  assert.equal(res.status, 200)

  const me = await authed('/api/users/me', { method: 'GET', token })
  assert.equal(me.body.profile.name, 'New Name')
  assert.equal(me.body.role, 'student')
  assert.equal(me.body.instructorVerified, false)
})

test('a moderator can verify an instructor, but a student cannot', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token: moderatorToken } = await makeUser('moderator')
  const { token: studentToken } = await makeUser('student')

  const blocked = await authed(`/api/users/instructors/${instructor._id}/verify`, { method: 'POST', token: studentToken })
  assert.equal(blocked.status, 403)

  const pending = await authed('/api/users/instructors/pending', { token: moderatorToken })
  assert.ok(pending.body.some((u) => String(u._id) === String(instructor._id)))

  const ok = await authed(`/api/users/instructors/${instructor._id}/verify`, { method: 'POST', token: moderatorToken })
  assert.equal(ok.status, 200)

  const after = await authed('/api/users/instructors/pending', { token: moderatorToken })
  assert.equal(after.body.some((u) => String(u._id) === String(instructor._id)), false)
})
