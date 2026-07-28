import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.REDIS_URL = 'redis://localhost:6379/14'
process.env.NODE_ENV = 'test'
// self-contained media dir so the streaming test doesn't depend on a downloaded video
const TEST_MEDIA_DIR = path.join(os.tmpdir(), `gyanpath-test-media-${process.pid}`)
process.env.MEDIA_DIR = TEST_MEDIA_DIR

let mongod
let server
let baseUrl
let User, Course, Lesson, Enrollment

before(async () => {
  // a small stand-in video the stream endpoint can serve with range support
  fs.mkdirSync(TEST_MEDIA_DIR, { recursive: true })
  fs.writeFileSync(path.join(TEST_MEDIA_DIR, 'sample.mp4'), Buffer.alloc(2048, 1))

  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  ;({ default: User } = await import('../models/User.js'))
  ;({ default: Course } = await import('../models/Course.js'))
  ;({ default: Lesson } = await import('../models/Lesson.js'))
  ;({ default: Enrollment } = await import('../models/Enrollment.js'))

  const { getRedis } = await import('../config/redis.js')
  await getRedis().flushdb()

  const { default: app } = await import('../app.js')
  server = app.listen(0)
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(async () => {
  await Promise.all([User, Course, Lesson, Enrollment].map((m) => m.deleteMany({})))
})

after(async () => {
  const { getRedis } = await import('../config/redis.js')
  await getRedis().quit()
  await mongoose.connection.close()
  await mongod.stop()
  server.close()
  fs.rmSync(TEST_MEDIA_DIR, { recursive: true, force: true })
})

const { hashPassword } = await import('../utils/password.js')
const { signAccessToken } = await import('../services/tokenService.js')

async function makeUser(role, overrides = {}) {
  const user = await User.create({
    email: `${role}-${Date.now()}-${Math.random()}@test.local`,
    passwordHash: await hashPassword('CorrectHorse9!Battery'),
    role,
    emailVerified: true,
    ...overrides,
  })
  return { user, token: signAccessToken(user) }
}

async function authed(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

test('instructor can create a course but not edit another instructor\'s course', async () => {
  const { token: tokenA } = await makeUser('instructor')
  const { token: tokenB } = await makeUser('instructor')

  const created = await authed('/api/courses', { method: 'POST', token: tokenA, body: { title: 'Course A', priceNPR: 1000 } })
  assert.equal(created.status, 201)

  const blocked = await authed(`/api/courses/${created.body._id}`, {
    method: 'PATCH',
    token: tokenB,
    body: { title: 'Hijacked' },
  })
  assert.equal(blocked.status, 404)
})

test('moderator approves a course, making it publicly visible', async () => {
  const { token: instructorToken } = await makeUser('instructor')
  const { token: modToken } = await makeUser('moderator')

  const created = await authed('/api/courses', { method: 'POST', token: instructorToken, body: { title: 'Loksewa Prep', priceNPR: 1200 } })
  await authed(`/api/courses/${created.body._id}/submit`, { method: 'POST', token: instructorToken })

  const publicListBefore = await authed('/api/courses')
  assert.equal(publicListBefore.body.length, 0)

  const review = await authed(`/api/courses/${created.body._id}/review`, { method: 'POST', token: modToken, body: { decision: 'approved' } })
  assert.equal(review.status, 200)

  const publicListAfter = await authed('/api/courses')
  assert.equal(publicListAfter.body.length, 1)
})

test('with no eSewa key configured, checkout enrolls the student directly (dev mode)', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Dev Enroll', priceNPR: 800, status: 'approved' })

  const res = await authed(`/api/courses/${course._id}/checkout`, { method: 'POST', token: studentToken })
  assert.equal(res.status, 200)
  assert.equal(res.body.devEnrolled, true)

  const enrollments = await authed('/api/enrollments/mine', { token: studentToken })
  assert.equal(enrollments.body.length, 1)
  assert.equal(enrollments.body[0].status, 'active')
})

test('re-enrolling after a refund reactivates the enrollment instead of crashing', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { user: student, token: studentToken } = await makeUser('student')
  const course = await Course.create({ instructorId: instructor._id, title: 'Re-enroll', priceNPR: 600, status: 'approved' })

  await authed(`/api/courses/${course._id}/checkout`, { method: 'POST', token: studentToken })
  // simulate a completed refund
  await Enrollment.updateOne({ userId: student._id, courseId: course._id }, { status: 'refunded' })

  const again = await authed(`/api/courses/${course._id}/checkout`, { method: 'POST', token: studentToken })
  assert.equal(again.status, 200)
  assert.equal(again.body.devEnrolled, true)

  const count = await Enrollment.countDocuments({ userId: student._id, courseId: course._id })
  assert.equal(count, 1)
  const enrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id })
  assert.equal(enrollment.status, 'active')
})

test('enrolling is a learner-only action — an instructor cannot check out', async () => {
  const { user: instructor, token: instructorToken } = await makeUser('instructor')
  const course = await Course.create({ instructorId: instructor._id, title: 'For Students', priceNPR: 900, status: 'approved' })

  const res = await authed(`/api/courses/${course._id}/checkout`, { method: 'POST', token: instructorToken })
  assert.equal(res.status, 403)

  const count = await Enrollment.countDocuments({ courseId: course._id })
  assert.equal(count, 0)
})

test('an unknown API route returns a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`)
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.error, 'not found')
})

test('student cannot review courses (RBAC)', async () => {
  const { token: instructorToken } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')

  const created = await authed('/api/courses', { method: 'POST', token: instructorToken, body: { title: 'X', priceNPR: 500 } })
  const res = await authed(`/api/courses/${created.body._id}/review`, { method: 'POST', token: studentToken, body: { decision: 'approved' } })
  assert.equal(res.status, 403)
})

test('content access: non-enrolled user is denied, enrolled user gets a working signed url, preview is open to anyone', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')
  const { token: outsiderToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'Paid Course', priceNPR: 1000, status: 'approved' })
  const previewLesson = await Lesson.create({ courseId: course._id, title: 'Intro', order: 1, isPreview: true })
  const paidLesson = await Lesson.create({ courseId: course._id, title: 'Main content', order: 2, isPreview: false })

  // anyone authenticated can reach a preview lesson
  const previewRes = await authed(`/api/content/${previewLesson._id}/signed-url`, { method: 'POST', token: outsiderToken })
  assert.equal(previewRes.status, 200)
  assert.ok(previewRes.body.streamUrl)

  // IDOR check: a non-enrolled, authenticated user must NOT get the paid lesson
  const deniedRes = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: outsiderToken })
  assert.equal(deniedRes.status, 403)

  // enroll the student directly (bypassing payment, which is exercised in payments.test.js)
  await Enrollment.create({ userId: (await authedUser(studentToken))._id, courseId: course._id, status: 'active' })

  const grantedRes = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: studentToken })
  assert.equal(grantedRes.status, 200)

  const token = grantedRes.body.streamUrl.split('/').pop()
  const streamRes = await fetch(`${baseUrl}/api/content/stream/${token}`)
  assert.equal(streamRes.status, 200)
  assert.equal(streamRes.headers.get('accept-ranges'), 'bytes')
  assert.equal(streamRes.headers.get('content-type'), 'video/mp4')

  // a range request returns just that slice (206), so the <video> element can seek
  const rangeRes = await fetch(`${baseUrl}/api/content/stream/${token}`, { headers: { Range: 'bytes=0-99' } })
  assert.equal(rangeRes.status, 206)
  assert.equal(rangeRes.headers.get('content-range'), 'bytes 0-99/2048')
  assert.equal(rangeRes.headers.get('content-length'), '100')

  // an invalid/made-up token must be rejected
  const badStreamRes = await fetch(`${baseUrl}/api/content/stream/not-a-real-token`)
  assert.equal(badStreamRes.status, 403)
})

test('a course owner can watch their own paid lesson without enrolling', async () => {
  const { user: instructor, token: instructorToken } = await makeUser('instructor')
  const { token: otherInstructorToken } = await makeUser('instructor')

  const course = await Course.create({ instructorId: instructor._id, title: 'Owned', priceNPR: 1000, status: 'approved' })
  const paidLesson = await Lesson.create({ courseId: course._id, title: 'Main content', order: 1, isPreview: false })

  // the owning instructor is allowed
  const ownerRes = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: instructorToken })
  assert.equal(ownerRes.status, 200)
  assert.ok(ownerRes.body.streamUrl)

  // a different instructor is not the owner and has no enrollment — denied
  const otherRes = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: otherInstructorToken })
  assert.equal(otherRes.status, 403)
})

test('a YouTube lesson only reveals its video id after the access check', async () => {
  const { user: instructor } = await makeUser('instructor')
  const { token: studentToken } = await makeUser('student')
  const { token: outsiderToken } = await makeUser('student')

  const course = await Course.create({ instructorId: instructor._id, title: 'YT Course', priceNPR: 1000, status: 'approved' })
  const paidLesson = await Lesson.create({ courseId: course._id, title: 'Paid', order: 1, isPreview: false, youtubeId: 'dQw4w9WgXcQ' })

  // not enrolled: the id must NOT be handed out
  const denied = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: outsiderToken })
  assert.equal(denied.status, 403)
  assert.equal(denied.body.youtubeId, undefined)

  // enrolled: gets the youtube provider + id
  await Enrollment.create({ userId: (await authedUser(studentToken))._id, courseId: course._id, status: 'active' })
  const granted = await authed(`/api/content/${paidLesson._id}/signed-url`, { method: 'POST', token: studentToken })
  assert.equal(granted.status, 200)
  assert.equal(granted.body.provider, 'youtube')
  assert.equal(granted.body.youtubeId, 'dQw4w9WgXcQ')
})

async function authedUser(token) {
  const { default: jwt } = await import('jsonwebtoken')
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  return User.findById(payload.sub)
}
