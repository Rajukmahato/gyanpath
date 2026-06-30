import User from '../models/User.js'
import { getRedis } from '../config/redis.js'
import { hashPassword, verifyPassword, wasRecentlyUsed, pushRecentPasswordHash } from '../utils/password.js'
import { checkPasswordStrength } from '../utils/passwordPolicy.js'
import { issueOtp, verifyOtp } from '../services/otpService.js'
import { generateMfaSecret, getQrCodeDataUrl, verifyMfaToken } from '../services/mfaService.js'
import {
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
  createRefreshSession,
  rotateRefreshToken,
  revokeRefreshFamily,
  revokeAllUserSessions,
} from '../services/tokenService.js'
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/cookies.js'
import { logAction } from '../services/auditService.js'

const LOGIN_FAIL_LIMIT = 5
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60

function loginFailKey(email) {
  return `loginfail:${email}`
}

async function recordLoginFailure(email) {
  const redis = getRedis()
  const key = loginFailKey(email)
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, LOGIN_FAIL_WINDOW_SECONDS)
  return count
}

async function issueSession(res, user) {
  const accessToken = signAccessToken(user)
  const refreshToken = await createRefreshSession(String(user._id))
  setRefreshCookie(res, refreshToken)
  return accessToken
}

export async function register(req, res) {
  const { email, password, name } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

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
    profile: { name },
  })

  const code = await issueOtp(`register:${user.email}`)
  console.log(`[dev] registration OTP for ${user.email}: ${code}`)

  await logAction({ actor: user._id, role: user.role, action: 'register', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  const devOtp = process.env.NODE_ENV !== 'production' ? { devOtp: code } : {}
  res.status(201).json({ message: 'registered, verify OTP to activate account', ...devOtp })
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

export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const normalizedEmail = email.toLowerCase()
  const failCount = await getRedis().get(loginFailKey(normalizedEmail))
  if (Number(failCount) >= LOGIN_FAIL_LIMIT) {
    return res.status(423).json({ error: 'account temporarily locked, try again later' })
  }

  const user = await User.findOne({ email: normalizedEmail })
  const valid = user && (await verifyPassword(user.passwordHash, password))

  if (!valid) {
    if (user) await recordLoginFailure(normalizedEmail)
    await logAction({ actor: user?._id, role: user?.role, action: 'login', resourceType: 'User', resourceId: user?._id, ip: req.ip, status: 'failure' })
    return res.status(401).json({ error: 'invalid credentials' })
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: 'email not verified' })
  }

  await getRedis().del(loginFailKey(normalizedEmail))

  if (user.mfaEnabled) {
    const mfaToken = signMfaChallenge(String(user._id))
    return res.json({ mfaRequired: true, mfaToken })
  }

  const accessToken = await issueSession(res, user)
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

  const accessToken = await issueSession(res, user)
  await logAction({ actor: user._id, role: user.role, action: 'mfa_verify', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ accessToken, user: { id: user._id, email: user.email, role: user.role } })
}

export async function setupMfa(req, res) {
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

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'no refresh token' })

  try {
    const { userId, refreshToken } = await rotateRefreshToken(token)
    const user = await User.findById(userId)
    if (!user) return res.status(401).json({ error: 'user not found' })

    setRefreshCookie(res, refreshToken)
    res.json({ accessToken: signAccessToken(user) })
  } catch (err) {
    clearRefreshCookie(res)
    if (err.code === 'REFRESH_REUSE') {
      return res.status(401).json({ error: 'session revoked, please log in again' })
    }
    return res.status(401).json({ error: 'invalid refresh token' })
  }
}

export async function me(req, res) {
  const { _id, email, role, profile, mfaEnabled, instructorVerified } = req.user
  res.json({ id: _id, email, role, profile, mfaEnabled, instructorVerified })
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
    console.log(`[dev] password reset OTP for ${user.email}: ${code}`)
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
  await user.save()

  await revokeAllUserSessions(String(user._id))
  await logAction({ actor: user._id, role: user.role, action: 'password_reset', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })

  res.json({ message: 'password updated, please log in again' })
}
