import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { getRedis } from '../config/redis.js'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function familyKey(familyId) {
  return `refresh:family:${familyId}`
}

function userSessionsKey(userId) {
  return `refresh:user:${userId}`
}

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

// Short-lived token issued after password check when MFA is enabled, before the TOTP step.
export function signMfaChallenge(userId) {
  return jwt.sign({ sub: userId, type: 'mfa_challenge' }, process.env.JWT_SECRET, { expiresIn: '5m' })
}

export function verifyMfaChallenge(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  if (payload.type !== 'mfa_challenge') throw new Error('not an mfa challenge token')
  return payload
}

// Issues a new refresh-token family for a fresh login.
export async function createRefreshSession(userId) {
  const familyId = randomUUID()
  const tokenId = randomUUID()
  const redis = getRedis()

  await redis.set(familyKey(familyId), tokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)
  await redis.sadd(userSessionsKey(userId), familyId)
  await redis.expire(userSessionsKey(userId), REFRESH_TOKEN_TTL_SECONDS)

  return signRefreshToken({ userId, familyId, tokenId })
}

function signRefreshToken({ userId, familyId, tokenId }) {
  return jwt.sign({ sub: userId, familyId, tokenId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  })
}

// Verifies + rotates a refresh token. Reusing an already-rotated token revokes the whole family
// (signals theft) rather than silently failing.
export async function rotateRefreshToken(token) {
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

  const newTokenId = randomUUID()
  await redis.set(familyKey(familyId), newTokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)

  return {
    userId,
    refreshToken: signRefreshToken({ userId, familyId, tokenId: newTokenId }),
  }
}

export async function revokeRefreshFamily(token) {
  try {
    const { familyId } = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    await getRedis().del(familyKey(familyId))
  } catch {
    // already invalid/expired - nothing to revoke
  }
}

export async function revokeAllUserSessions(userId) {
  const redis = getRedis()
  const families = await redis.smembers(userSessionsKey(userId))
  if (families.length) {
    await redis.del(...families.map(familyKey))
  }
  await redis.del(userSessionsKey(userId))
}
