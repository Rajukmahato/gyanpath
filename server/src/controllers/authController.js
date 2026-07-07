import User from '../models/User.js'
import { getRedis } from '../config/redis.js'
import { hashPassword, verifyPassword, wasRecentlyUsed, pushRecentPasswordHash } from '../utils/password.js'
import { checkPasswordStrength } from '../utils/passwordPolicy.js'
import { issueOtp, verifyOtp } from '../services/otpService.js'
import { sendOtpEmail, isEmailConfigured } from '../services/emailService.js'
import { generateMfaSecret, getQrCodeDataUrl, verifyMfaToken } from '../services/mfaService.js'
import {
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
  signPasswordChangeChallenge,
  verifyPasswordChangeChallenge,
  createRefreshSession,
  rotateRefreshToken,
  revokeRefreshFamily,
  revokeAllUserSessions,
} from '../services/tokenService.js'
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/cookies.js'
import { logAction } from '../services/auditService.js'
import { flagBurst } from '../services/alertService.js'

const LOGIN_FAIL_LIMIT = 5
const LOGIN_FAIL_CAPTCHA_THRESHOLD = 3  // show CAPTCHA after this many failures
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000' // test secret
// NIST SP 800-63B argues against mandatory rotation; the brief still requires it, so we
// enforce 90 days but document the tension in the report.
const PASSWORD_MAX_AGE_DAYS = 90
const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000

function isPasswordExpired(user) {
  if (!user.passwordChangedAt) return false
  return Date.now() - new Date(user.passwordChangedAt).getTime() > PASSWORD_MAX_AGE_MS
}

function loginFailKey(email) {
  return `loginfail:${email}`
}

async function recordLoginFailure(email) {
  return flagBurst(loginFailKey(email), {
    windowSeconds: LOGIN_FAIL_WINDOW_SECONDS,
    threshold: LOGIN_FAIL_LIMIT,
    message: `Repeated failed logins for ${email} — account temporarily locked`,
  })
}

async function issueSession(res, user, ip) {
  const accessToken = signAccessToken(user)
  const refreshToken = await createRefreshSession(String(user._id), ip)
  setRefreshCookie(res, refreshToken)
  return accessToken
}

// email the code when Gmail is configured; otherwise log it so dev flows still work
async function deliverOtp(email, code, purpose) {
  const sent = await sendOtpEmail(email, code, purpose).catch(() => false)
  if (!sent) console.log(`[dev] ${purpose} OTP for ${email}: ${code}`)
}

export async function register(req, res) {
  const { email, password, name, role } = req.body

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' })
  }

  // a new user may sign up as a learner or an instructor; privileged roles
  // (moderator/admin) can never be self-assigned through registration
  const safeRole = role === 'instructor' ? 'instructor' : 'student'

  const strength = checkPasswordStrength(password)
  if (!strength.ok) {
    return res.status(400).json({ error: 'weak password', reasons: strength.reasons })
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    return res.status(409).json({ error: 'email already registered' })
  }

  const passwordHash = await hashPassword(password)
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: safeRole,
    profile: { name },
  })

  const code = await issueOtp(`register:${user.email}`)
  await deliverOtp(user.email, code, 'register')

  await logAction({ actor: user._id, role: user.role, action: 'register', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  // only surface the code in the response when there's no real email delivery (dev)
  const devOtp = process.env.NODE_ENV !== 'production' && !isEmailConfigured() ? { devOtp: code } : {}
  res.status(201).json({ message: 'registered, verify OTP to activate account', ...devOtp })
}

export async function resendRegistrationOtp(req, res) {
  const { email } = req.body
  const user = typeof email === 'string' ? await User.findOne({ email: email.toLowerCase() }) : null

  // respond the same way whether or not the account exists / is already verified,
  // so this can't be used to probe which emails are registered
  if (user && !user.emailVerified) {
    const code = await issueOtp(`register:${user.email}`)
    await deliverOtp(user.email, code, 'register')
    if (process.env.NODE_ENV !== 'production' && !isEmailConfigured()) {
      return res.json({ message: 'a new code has been sent', devOtp: code })
    }
  }

  res.json({ message: 'a new code has been sent' })
}

export async function verifyRegistrationOtp(req, res) {
  const { email, code } = req.body
  const user = await User.findOne({ email: email?.toLowerCase() })
  if (!user) return res.status(404).json({ error: 'user not found' })

  const valid = await verifyOtp(`register:${user.email}`, code)
  if (!valid) return res.status(400).json({ error: 'invalid or expired code' })

  user.emailVerified = true
  await user.save()

  await logAction({ actor: user._id, role: user.role, action: 'otp_verify', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ message: 'email verified' })
}

async function verifyCaptcha(token) {
  if (!token) return false
  try {
    const params = new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token })
    const r = await fetch('https://hcaptcha.com/siteverify', { method: 'POST', body: params })
    const data = await r.json()
    return data.success === true
  } catch {
    return false
  }
}

export async function login(req, res) {
  const { email, password, captchaToken } = req.body
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const normalizedEmail = email.toLowerCase()
  const failCount = Number(await getRedis().get(loginFailKey(normalizedEmail)) || 0)

  if (failCount >= LOGIN_FAIL_LIMIT) {
    return res.status(423).json({ error: 'account temporarily locked, try again later' })
  }

  // require a valid CAPTCHA once the account has had too many failures. Keep counting
  // failures here too, so the hard lockout at LOGIN_FAIL_LIMIT stays reachable even
  // while the CAPTCHA gate is active.
  if (failCount >= LOGIN_FAIL_CAPTCHA_THRESHOLD) {
    const captchaOk = await verifyCaptcha(captchaToken)
    if (!captchaOk) {
      await recordLoginFailure(normalizedEmail)
      return res.status(400).json({ error: 'captcha required', captchaRequired: true })
    }
  }

  const user = await User.findOne({ email: normalizedEmail })
  const valid = user && (await verifyPassword(user.passwordHash, password))

  if (!valid) {
    if (user) await recordLoginFailure(normalizedEmail)
    await logAction({ actor: user?._id, role: user?.role, action: 'login', resourceType: 'User', resourceId: user?._id, ip: req.ip, status: 'failure' })
    const newCount = failCount + 1
    return res.status(401).json({
      error: 'invalid credentials',
      captchaRequired: newCount >= LOGIN_FAIL_CAPTCHA_THRESHOLD,
    })
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: 'email not verified' })
  }

  await getRedis().del(loginFailKey(normalizedEmail))

  // MFA-enabled accounts must clear the second factor before anything else — including
  // the password-expiry gate — so a stolen password alone can never force a change
  if (user.mfaEnabled) {
    const mfaToken = signMfaChallenge(String(user._id))
    return res.json({ mfaRequired: true, mfaToken })
  }

  if (isPasswordExpired(user)) {
    const passwordChangeToken = signPasswordChangeChallenge(String(user._id))
    await logAction({ actor: user._id, role: user.role, action: 'password_expired', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'failure' })
    return res.json({ passwordExpired: true, passwordChangeToken })
  }

  const accessToken = await issueSession(res, user, req.ip)
  await logAction({ actor: user._id, role: user.role, action: 'login', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ accessToken, user: { id: user._id, email: user.email, role: user.role } })
}

export async function verifyMfaLogin(req, res) {
  const { mfaToken, token } = req.body
  if (!mfaToken || !token) return res.status(400).json({ error: 'mfaToken and token are required' })

  let payload
  try {
    payload = verifyMfaChallenge(mfaToken)
  } catch {
    return res.status(401).json({ error: 'invalid or expired mfa challenge' })
  }

  const user = await User.findById(payload.sub)
  if (!user?.mfaSecret) return res.status(400).json({ error: 'mfa not configured' })

  if (!verifyMfaToken(user.mfaSecret, token)) {
    await logAction({ actor: user._id, role: user.role, action: 'mfa_verify', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'failure' })
    return res.status(401).json({ error: 'invalid mfa code' })
  }

  // both factors are now satisfied, so an expired password can be safely forced to change
  if (isPasswordExpired(user)) {
    const passwordChangeToken = signPasswordChangeChallenge(String(user._id))
    await logAction({ actor: user._id, role: user.role, action: 'password_expired', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'failure' })
    return res.json({ passwordExpired: true, passwordChangeToken })
  }

  const accessToken = await issueSession(res, user, req.ip)
  await logAction({ actor: user._id, role: user.role, action: 'mfa_verify', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ accessToken, user: { id: user._id, email: user.email, role: user.role } })
}

export async function setupMfa(req, res) {
  // never allow setup while MFA is already enabled — the user must disable first
  if (req.user.mfaEnabled) return res.status(409).json({ error: 'mfa already enabled, disable it first to re-setup' })
  const { base32, otpauthUrl } = generateMfaSecret(req.user.email)
  req.user.mfaSecret = base32
  await req.user.save()

  const qrDataUrl = await getQrCodeDataUrl(otpauthUrl)
  res.json({ qrDataUrl, secret: base32 })
}

export async function enableMfa(req, res) {
  const { token } = req.body
  if (!req.user.mfaSecret) return res.status(400).json({ error: 'call mfa/setup first' })

  if (!verifyMfaToken(req.user.mfaSecret, token)) {
    return res.status(400).json({ error: 'invalid mfa code' })
  }

  req.user.mfaEnabled = true
  await req.user.save()

  res.json({ message: 'mfa enabled' })
}

export async function disableMfa(req, res) {
  const { token } = req.body
  if (!req.user.mfaEnabled) return res.status(400).json({ error: 'mfa is not enabled' })

  if (!verifyMfaToken(req.user.mfaSecret, token)) {
    return res.status(401).json({ error: 'invalid mfa code' })
  }

  req.user.mfaEnabled = false
  req.user.mfaSecret = undefined
  await req.user.save()

  res.json({ message: 'mfa disabled' })
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'no refresh token' })

  try {
    const { userId, refreshToken } = await rotateRefreshToken(token, req.ip)
    const user = await User.findById(userId)
    if (!user) return res.status(401).json({ error: 'user not found' })

    setRefreshCookie(res, refreshToken)
    res.json({ accessToken: signAccessToken(user) })
  } catch (err) {
    clearRefreshCookie(res)
    if (err.code === 'REFRESH_REUSE') {
      return res.status(401).json({ error: 'session revoked, please log in again' })
    }
    if (err.code === 'IP_MISMATCH') {
      return res.status(401).json({ error: 'session expired due to network change, please log in again' })
    }
    return res.status(401).json({ error: 'invalid refresh token' })
  }
}

export async function me(req, res) {
  const { _id, email, role, profile, mfaEnabled, instructorVerified, avatarUrl } = req.user
  res.json({ id: _id, email, role, profile, mfaEnabled, instructorVerified, avatarUrl })
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (token) await revokeRefreshFamily(token)
  clearRefreshCookie(res)
  res.json({ message: 'logged out' })
}

export async function requestPasswordReset(req, res) {
  const { email } = req.body
  const user = await User.findOne({ email: email?.toLowerCase() })

  // always respond the same way so the endpoint can't be used to enumerate registered emails
  if (user) {
    const code = await issueOtp(`pwreset:${user.email}`)
    await deliverOtp(user.email, code, 'pwreset')
  }

  res.json({ message: 'if that email is registered, a reset code has been sent' })
}

export async function confirmPasswordReset(req, res) {
  const { email, code, newPassword } = req.body
  const user = await User.findOne({ email: email?.toLowerCase() })
  if (!user) return res.status(400).json({ error: 'invalid request' })

  const valid = await verifyOtp(`pwreset:${user.email}`, code)
  if (!valid) return res.status(400).json({ error: 'invalid or expired code' })

  const strength = checkPasswordStrength(newPassword)
  if (!strength.ok) {
    return res.status(400).json({ error: 'weak password', reasons: strength.reasons })
  }

  const allRecentHashes = [user.passwordHash, ...user.recentPasswordHashes]
  if (await wasRecentlyUsed(allRecentHashes, newPassword)) {
    return res.status(400).json({ error: 'password was used recently, choose a different one' })
  }

  user.recentPasswordHashes = pushRecentPasswordHash(user.recentPasswordHashes, user.passwordHash)
  user.passwordHash = await hashPassword(newPassword)
  user.passwordChangedAt = new Date()
  await user.save()

  await revokeAllUserSessions(String(user._id))
  await logAction({ actor: user._id, role: user.role, action: 'password_reset', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ message: 'password updated, please log in again' })
}

// Completes a forced change after login reported the password expired. The short-lived
// pw_change token stands in for re-auth, so no OTP round-trip is needed.
export async function changeExpiredPassword(req, res) {
  const { passwordChangeToken, newPassword } = req.body
  if (!passwordChangeToken || !newPassword) {
    return res.status(400).json({ error: 'passwordChangeToken and newPassword are required' })
  }

  let payload
  try {
    payload = verifyPasswordChangeChallenge(passwordChangeToken)
  } catch {
    return res.status(401).json({ error: 'invalid or expired change token' })
  }

  const user = await User.findById(payload.sub)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const strength = checkPasswordStrength(newPassword)
  if (!strength.ok) {
    return res.status(400).json({ error: 'weak password', reasons: strength.reasons })
  }

  const allRecentHashes = [user.passwordHash, ...user.recentPasswordHashes]
  if (await wasRecentlyUsed(allRecentHashes, newPassword)) {
    return res.status(400).json({ error: 'password was used recently, choose a different one' })
  }

  user.recentPasswordHashes = pushRecentPasswordHash(user.recentPasswordHashes, user.passwordHash)
  user.passwordHash = await hashPassword(newPassword)
  user.passwordChangedAt = new Date()
  await user.save()

  await revokeAllUserSessions(String(user._id))
  await logAction({ actor: user._id, role: user.role, action: 'password_change_forced', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ message: 'password updated, please log in again' })
}
