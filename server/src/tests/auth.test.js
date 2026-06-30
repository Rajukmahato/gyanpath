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

test('rejects wrong password and locks out after repeated failures', async () => {
  const email = 'lockout@test.local'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })

  let lastStatus
  for (let i = 0; i < 5; i++) {
    const res = await post('/api/auth/login', { email, password: 'wrong-password' })
    lastStatus = res.status
  }
  assert.equal(lastStatus, 401)

  const lockedRes = await post('/api/auth/login', { email, password: PASSWORD })
  assert.equal(lockedRes.status, 423)
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
