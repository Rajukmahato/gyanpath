import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import speakeasy from 'speakeasy'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '4a04130c3b00ae1e49682527f8879e50274d33c0af2fa6c133c5050aca1cf083'
process.env.REDIS_URL = 'redis://localhost:6379/15' // dedicated DB index, kept separate from dev data
process.env.NODE_ENV = 'test'

let mongod
let server
let baseUrl

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  const { getRedis } = await import('../config/redis.js')
  await getRedis().flushdb()

  const { default: app } = await import('../app.js')
  server = app.listen(0)
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  const { getRedis } = await import('../config/redis.js')
  await getRedis().quit()
  await mongoose.connection.close()
  await mongod.stop()
  server.close()
})

async function post(path, body, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json(), headers: res.headers }
}

function getCookie(headers) {
  const raw = headers.get('set-cookie')
  return raw?.split(';')[0]
}

const EMAIL = 'student@test.local'
const PASSWORD = 'CorrectHorse9!Battery'

test('register -> otp verify -> login -> access protected route', async () => {
  const reg = await post('/api/auth/register', { email: EMAIL, password: PASSWORD, name: 'Test Student' })
  assert.equal(reg.status, 201)
  assert.ok(reg.body.devOtp)

  const verify = await post('/api/auth/otp/verify', { email: EMAIL, code: reg.body.devOtp })
  assert.equal(verify.status, 200)

  const login = await post('/api/auth/login', { email: EMAIL, password: PASSWORD })
  assert.equal(login.status, 200)
  assert.ok(login.body.accessToken)

  const refreshCookie = getCookie(login.headers)
  assert.ok(refreshCookie?.startsWith('refreshToken='))

  const protectedRes = await fetch(`${baseUrl}/api/auth/mfa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.body.accessToken}` },
  })
  assert.equal(protectedRes.status, 200)

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.body.accessToken}` },
  })
  const me = await meRes.json()
  assert.equal(meRes.status, 200)
  assert.equal(me.email, EMAIL)
  assert.equal(me.role, 'student')
})

test('can register as an instructor, but cannot self-assign a privileged role', async () => {
  const instructorEmail = 'teacher@test.local'
  const reg = await post('/api/auth/register', { email: instructorEmail, password: PASSWORD, role: 'instructor' })
  await post('/api/auth/otp/verify', { email: instructorEmail, code: reg.body.devOtp })
  const login = await post('/api/auth/login', { email: instructorEmail, password: PASSWORD })
  assert.equal(login.body.user.role, 'instructor')

  // attempting to register as admin must fall back to student
  const sneakyEmail = 'sneaky@test.local'
  const reg2 = await post('/api/auth/register', { email: sneakyEmail, password: PASSWORD, role: 'admin' })
  await post('/api/auth/otp/verify', { email: sneakyEmail, code: reg2.body.devOtp })
  const login2 = await post('/api/auth/login', { email: sneakyEmail, password: PASSWORD })
  assert.equal(login2.body.user.role, 'student')
})

test('resend OTP lets a user recover after leaving the verify screen', async () => {
  const email = 'resend@test.local'
  await post('/api/auth/register', { email, password: PASSWORD })

  const resend = await post('/api/auth/otp/resend', { email })
  assert.equal(resend.status, 200)
  assert.ok(resend.body.devOtp)

  const verify = await post('/api/auth/otp/verify', { email, code: resend.body.devOtp })
  assert.equal(verify.status, 200)
})

test('rejects a NoSQL operator-injection login payload instead of bypassing auth', async () => {
  // the classic Mongo auth bypass: { email: { $ne: null }, password: { $ne: null } }
  // must not return a session, and must fail cleanly (400) rather than crash (500)
  const res = await post('/api/auth/login', { email: { $ne: null }, password: { $ne: null } })
  assert.equal(res.status, 400)
  assert.equal(res.body.accessToken, undefined)
})

test('rejects wrong password, then requires CAPTCHA, then locks out', async () => {
  const email = 'lockout@test.local'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })

  // the first 3 wrong attempts are plain 401 rejections
  let lastStatus
  for (let i = 0; i < 3; i++) {
    const res = await post('/api/auth/login', { email, password: 'wrong-password' })
    lastStatus = res.status
  }
  assert.equal(lastStatus, 401)

  // after the CAPTCHA threshold, a missing/invalid CAPTCHA is rejected with 400
  const captchaRes = await post('/api/auth/login', { email, password: 'wrong-password' })
  assert.equal(captchaRes.status, 400)
  assert.equal(captchaRes.body.captchaRequired, true)

  // failures keep accruing behind the CAPTCHA gate until the hard lockout kicks in
  let lockedStatus
  for (let i = 0; i < 4; i++) {
    const res = await post('/api/auth/login', { email, password: PASSWORD })
    lockedStatus = res.status
  }
  assert.equal(lockedStatus, 423)
})

test('refresh token rotates, and reusing an old token revokes the session', async () => {
  const email = 'rotate@test.local'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })
  const login = await post('/api/auth/login', { email, password: PASSWORD })
  const firstCookie = getCookie(login.headers)

  const firstRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: firstCookie },
  })
  assert.equal(firstRefresh.status, 200)
  const secondCookie = getCookie(firstRefresh.headers)
  assert.notEqual(secondCookie, firstCookie)

  // reusing the now-rotated-out first refresh token should be treated as theft and revoke the family
  const reuseAttempt = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: firstCookie },
  })
  assert.equal(reuseAttempt.status, 401)

  const afterRevocation = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: secondCookie },
  })
  assert.equal(afterRevocation.status, 401)
})

test('mfa setup -> enable -> login requires totp code', async () => {
  const email = 'mfa@test.local'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })
  const login = await post('/api/auth/login', { email, password: PASSWORD })

  const setupRes = await fetch(`${baseUrl}/api/auth/mfa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.body.accessToken}` },
  })
  const { secret } = await setupRes.json()

  const code = speakeasy.totp({ secret, encoding: 'base32' })
  const enableRes = await post(
    '/api/auth/mfa/enable',
    { token: code },
    { headers: { Authorization: `Bearer ${login.body.accessToken}` } },
  )
  assert.equal(enableRes.status, 200)

  const secondLogin = await post('/api/auth/login', { email, password: PASSWORD })
  assert.equal(secondLogin.status, 200)
  assert.equal(secondLogin.body.mfaRequired, true)
  assert.ok(secondLogin.body.mfaToken)

  const mfaCode = speakeasy.totp({ secret, encoding: 'base32' })
  const mfaVerify = await post('/api/auth/mfa/login-verify', { mfaToken: secondLogin.body.mfaToken, token: mfaCode })
  assert.equal(mfaVerify.status, 200)
  assert.ok(mfaVerify.body.accessToken)
})

test('password reset rejects reuse of the current password', async () => {
  const email = 'reset@test.local'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })

  const { issueOtp } = await import('../services/otpService.js')
  const resetCode = await issueOtp(`pwreset:${email}`)

  const reuseAttempt = await post('/api/auth/password-reset/confirm', { email, code: resetCode, newPassword: PASSWORD })
  assert.equal(reuseAttempt.status, 400)
  assert.match(reuseAttempt.body.error, /used recently/)
})
