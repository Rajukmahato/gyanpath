import jwt from 'jsonwebtoken'
import { randomUUID, createHash } from 'node:crypto'
import { getRedis } from '../config/redis.js'

const ACCESS_TOKEN_TTL = '15d'
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function familyKey(familyId) {
  return `refresh:family:${familyId}`
}

function familyIpKey(familyId) {
  return `refresh:family:ip:${familyId}`
}

function familyUaKey(familyId) {
  return `refresh:family:ua:${familyId}`
}

function userSessionsKey(userId) {
  return `refresh:user:${userId}`
}

// a short, stable hash of the browser's User-Agent, so we can detect a refresh token
// being replayed from a different device/browser without storing the raw UA string
export function deviceHash(userAgent) {
  if (!userAgent) return null
  return createHash('sha256').update(userAgent).digest('hex').slice(0, 16)
}

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

export function signMfaChallenge(userId) {
  return jwt.sign({ sub: userId, type: 'mfa_challenge' }, process.env.JWT_SECRET, { expiresIn: '5m' })
}

export function verifyMfaChallenge(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  if (payload.type !== 'mfa_challenge') throw new Error('not an mfa challenge token')
  return payload
}

// Short-lived token issued when a valid login is blocked only because the password
// has expired — it authorizes exactly one password change, nothing else.
export function signPasswordChangeChallenge(userId) {
  return jwt.sign({ sub: userId, type: 'pw_change' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

export function verifyPasswordChangeChallenge(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  if (payload.type !== 'pw_change') throw new Error('not a password-change token')
  return payload
}

// Returns the /24 subnet string for IPv4 or /48 for IPv6, used for drift detection.
// Loopback and private-only sessions are not bound (development traffic).
function ipSubnet(ip) {
  if (!ip) return null
  // Strip IPv4-mapped IPv6 prefix
  const raw = ip.replace(/^::ffff:/, '')
  if (raw === '127.0.0.1' || raw === '::1') return null // loopback — skip binding
  if (/^\d+\.\d+\.\d+\.\d+$/.test(raw)) {
    // IPv4: bind to /24
    const parts = raw.split('.')
    return `${parts[0]}.${parts[1]}.${parts[2]}`
  }
  // IPv6: bind to first 4 groups (/64 equivalent)
  const groups = raw.split(':').slice(0, 4).join(':')
  return groups || null
}

export async function createRefreshSession(userId, ip, userAgent) {
  const familyId = randomUUID()
  const tokenId = randomUUID()
  const redis = getRedis()
  const subnet = ipSubnet(ip)
  const device = deviceHash(userAgent)

  await redis.set(familyKey(familyId), tokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  if (subnet) {
    await redis.set(familyIpKey(familyId), subnet, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  }
  if (device) {
    await redis.set(familyUaKey(familyId), device, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  }
  await redis.sadd(userSessionsKey(userId), familyId)
  await redis.expire(userSessionsKey(userId), REFRESH_TOKEN_TTL_SECONDS)

  return signRefreshToken({ userId, familyId, tokenId })
}

function signRefreshToken({ userId, familyId, tokenId }) {
  return jwt.sign({ sub: userId, familyId, tokenId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  })
}

export async function rotateRefreshToken(token, ip, userAgent) {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
  const { sub: userId, familyId, tokenId } = payload
  const redis = getRedis()

  const currentTokenId = await redis.get(familyKey(familyId))

  if (!currentTokenId || currentTokenId !== tokenId) {
    await redis.del(familyKey(familyId))
    const err = new Error('refresh token reuse detected')
    err.code = 'REFRESH_REUSE'
    throw err
  }

  // IP subnet drift check
  const storedSubnet = await redis.get(familyIpKey(familyId))
  if (storedSubnet) {
    const currentSubnet = ipSubnet(ip)
    if (currentSubnet && currentSubnet !== storedSubnet) {
      // Revoke this session — different network, possible session hijack
      await redis.del(familyKey(familyId), familyIpKey(familyId), familyUaKey(familyId))
      const err = new Error('session IP mismatch — please log in again')
      err.code = 'IP_MISMATCH'
      throw err
    }
  }

  // device / User-Agent binding check — a refresh cookie replayed from a different
  // browser or device won't match the fingerprint captured at login
  const storedDevice = await redis.get(familyUaKey(familyId))
  if (storedDevice) {
    const currentDevice = deviceHash(userAgent)
    if (currentDevice && currentDevice !== storedDevice) {
      await redis.del(familyKey(familyId), familyIpKey(familyId), familyUaKey(familyId))
      const err = new Error('session device mismatch — please log in again')
      err.code = 'DEVICE_MISMATCH'
      throw err
    }
  }

  const newTokenId = randomUUID()
  await redis.set(familyKey(familyId), newTokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  if (storedSubnet) {
    await redis.set(familyIpKey(familyId), storedSubnet, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  }
  if (storedDevice) {
    await redis.set(familyUaKey(familyId), storedDevice, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  }

  return {
    userId,
    refreshToken: signRefreshToken({ userId, familyId, tokenId: newTokenId }),
  }
}

export async function revokeRefreshFamily(token) {
  try {
    const { familyId } = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    await getRedis().del(familyKey(familyId), familyIpKey(familyId), familyUaKey(familyId))
  } catch {
    // already invalid/expired
  }
}

export async function revokeAllUserSessions(userId) {
  const redis = getRedis()
  const families = await redis.smembers(userSessionsKey(userId))
  if (families.length) {
    const keys = families.flatMap((f) => [familyKey(f), familyIpKey(f), familyUaKey(f)])
    await redis.del(...keys)
  }
  await redis.del(userSessionsKey(userId))
}
