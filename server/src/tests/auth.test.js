import { test, before, after, beforeEach } from 'node:test'
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

// Rate limiters and the login-failure counter live in Redis keyed by client IP, and every
// test here hits the server from the same loopback IP. Reset between tests so one test's
// attempts don't exhaust another's rate-limit budget (order-independent, isolated state).
beforeEach(async () => {
  const { getRedis } = await import('../config/redis.js')
  await getRedis().flushdb()
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

  // the first 6 wrong attempts (below the CAPTCHA threshold) are plain 401 rejections
  let lastStatus
  for (let i = 0; i < 6; i++) {
    const res = await post('/api/auth/login', { email, password: 'wrong-password' })
    lastStatus = res.status
  }
  assert.equal(lastStatus, 401)

  // after the CAPTCHA threshold (6 failures), a missing/invalid CAPTCHA is rejected with 400
  const captchaRes = await post('/api/auth/login', { email, password: 'wrong-password' })
  assert.equal(captchaRes.status, 400)
  assert.equal(captchaRes.body.captchaRequired, true)

  // failures keep accruing behind the CAPTCHA gate until the hard lockout (12) kicks in
  let lockedStatus
  for (let i = 0; i < 6; i++) {
    const res = await post('/api/auth/login', { email, password: PASSWORD })
    lockedStatus = res.status
  }
  assert.equal(lockedStatus, 423)
})

test('google oauth start is gated when the provider is not configured', async () => {
  // no GOOGLE_CLIENT_ID/SECRET in the test env, so the endpoint should refuse rather than
  // redirect to a broken consent screen
  const res = await fetch(`${baseUrl}/api/auth/oauth/google`, { redirect: 'manual' })
  assert.equal(res.status, 503)

  // ...and the SPA is told so, which is how the Login page knows to hide the button
  const providers = await fetch(`${baseUrl}/api/auth/oauth/providers`)
  assert.deepEqual(await providers.json(), { google: false })
})

// Runs `fn` with fake Google credentials in the environment, then restores it. The OAuth
// helpers read process.env at call time, so this flips the feature on for one test.
async function withGoogleConfigured(fn) {
  const saved = { ...process.env }
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/auth/oauth/google/callback'
  try {
    await fn()
  } finally {
    for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

test('google oauth start redirects to the consent screen and plants an anti-CSRF state cookie', async () => {
  await withGoogleConfigured(async () => {
    const providers = await fetch(`${baseUrl}/api/auth/oauth/providers`)
    assert.deepEqual(await providers.json(), { google: true })

    const res = await fetch(`${baseUrl}/api/auth/oauth/google`, { redirect: 'manual' })
    assert.equal(res.status, 302)

    const location = new URL(res.headers.get('location'))
    assert.equal(location.origin + location.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
    assert.equal(location.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com')
    assert.equal(location.searchParams.get('response_type'), 'code')
    assert.equal(location.searchParams.get('scope'), 'openid email profile')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'http://localhost:4000/api/auth/oauth/google/callback',
    )

    // the state in the URL must be the same value stashed in the cookie the callback checks
    const cookie = getCookie(res.headers)
    assert.ok(cookie?.startsWith('oauth_state='))
    assert.equal(cookie.split('=')[1], location.searchParams.get('state'))
  })
})

test('google oauth callback rejects a state that does not match the cookie', async () => {
  await withGoogleConfigured(async () => {
    const start = await fetch(`${baseUrl}/api/auth/oauth/google`, { redirect: 'manual' })
    const cookie = getCookie(start.headers)

    // an attacker-supplied code/state pair, replayed against the victim's browser
    const res = await fetch(`${baseUrl}/api/auth/oauth/google/callback?code=abc&state=not-the-real-state`, {
      redirect: 'manual',
      headers: { Cookie: cookie },
    })
    assert.equal(res.status, 302)
    assert.match(res.headers.get('location'), /\/login\?oauth_error=invalid_state$/)
  })
})

// Stands in for Google's token + userinfo endpoints so the callback can be driven end to
// end offline. Anything not addressed to Google (i.e. our own test requests) passes through.
async function withStubbedGoogleIdentity(profile, fn) {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input)
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'stub-google-access-token' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
      return new Response(JSON.stringify(profile), { headers: { 'Content-Type': 'application/json' } })
    }
    return realFetch(input, init)
  }
  try {
    await fn()
  } finally {
    globalThis.fetch = realFetch
  }
}

// Walks the whole redirect dance: start -> (Google) -> callback, returning the callback response.
async function runGoogleCallback() {
  const start = await globalThis.fetch(`${baseUrl}/api/auth/oauth/google`, { redirect: 'manual' })
  const cookie = getCookie(start.headers)
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  return globalThis.fetch(
    `${baseUrl}/api/auth/oauth/google/callback?code=stub-auth-code&state=${state}`,
    { redirect: 'manual', headers: { Cookie: cookie } },
  )
}

test('google oauth callback creates a verified account and hands the SPA a session', async () => {
  const email = 'newgoogleuser@test.local'
  await withGoogleConfigured(async () => {
    await withStubbedGoogleIdentity(
      { sub: 'google-sub-1', email, email_verified: true, name: 'Sita Gurung' },
      async () => {
        const res = await runGoogleCallback()
        assert.equal(res.status, 302)

        const location = res.headers.get('location')
        assert.ok(location.startsWith('http://localhost:5173/oauth/callback#access_token='))

        // the token rides in the fragment, and the refresh cookie is set alongside it
        const accessToken = new URLSearchParams(new URL(location).hash.slice(1)).get('access_token')
        const me = await globalThis.fetch(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        assert.equal(me.status, 200)
        assert.equal((await me.json()).email, email)

        const { default: User } = await import('../models/User.js')
        const user = await User.findOne({ email })
        assert.equal(user.emailVerified, true) // Google vouched for it, so no OTP round-trip
        assert.equal(user.oauthProvider, 'google')
      },
    )
  })
})

test('google oauth refuses an unverified google email', async () => {
  await withGoogleConfigured(async () => {
    await withStubbedGoogleIdentity(
      { sub: 'google-sub-2', email: 'unverified@test.local', email_verified: false, name: 'No Proof' },
      async () => {
        const res = await runGoogleCallback()
        assert.match(res.headers.get('location'), /\/login\?oauth_error=email_unverified$/)
      },
    )
  })
})

test('google oauth still demands the second factor on an MFA-enabled account', async () => {
  const email = 'mfagoogle@test.local'
  const { default: User } = await import('../models/User.js')
  const { hashPassword } = await import('../utils/password.js')
  await User.create({
    email,
    passwordHash: await hashPassword(PASSWORD),
    emailVerified: true,
    mfaEnabled: true,
  })

  await withGoogleConfigured(async () => {
    await withStubbedGoogleIdentity(
      { sub: 'google-sub-3', email, email_verified: true, name: 'Two Factor' },
      async () => {
        const res = await runGoogleCallback()
        const location = res.headers.get('location')

        // no session yet — only an MFA challenge, exactly as a password login would give
        assert.ok(!location.includes('access_token='))
        const mfaToken = new URLSearchParams(new URL(location).hash.slice(1)).get('mfa_token')
        assert.ok(mfaToken)
        assert.equal(getCookie(res.headers)?.startsWith('refreshToken='), false)
      },
    )
  })
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

test('authenticated password change: wrong current is rejected, valid change rotates the login', async () => {
  const email = 'changepw@test.local'
  const newPassword = 'FreshPass7!Zephyr'
  const reg = await post('/api/auth/register', { email, password: PASSWORD })
  await post('/api/auth/otp/verify', { email, code: reg.body.devOtp })

  const login = await post('/api/auth/login', { email, password: PASSWORD })
  const auth = { Authorization: `Bearer ${login.body.accessToken}` }

  // wrong current password is rejected without changing anything
  const wrong = await post('/api/auth/password/change', { currentPassword: 'nope-not-it', newPassword }, { headers: auth })
  assert.equal(wrong.status, 400)
  assert.match(wrong.body.error, /current password is incorrect/)

  // a weak new password is rejected
  const weak = await post('/api/auth/password/change', { currentPassword: PASSWORD, newPassword: 'weak' }, { headers: auth })
  assert.equal(weak.status, 400)
  assert.match(weak.body.error, /weak password/)

  // valid change succeeds and hands back a fresh session
  const ok = await post('/api/auth/password/change', { currentPassword: PASSWORD, newPassword }, { headers: auth })
  assert.equal(ok.status, 200)
  assert.ok(ok.body.accessToken)
  assert.ok(getCookie(ok.headers)?.startsWith('refreshToken='))

  // the old password no longer logs in; the new one does
  const oldLogin = await post('/api/auth/login', { email, password: PASSWORD })
  assert.equal(oldLogin.status, 401)
  const newLogin = await post('/api/auth/login', { email, password: newPassword })
  assert.equal(newLogin.status, 200)
})
