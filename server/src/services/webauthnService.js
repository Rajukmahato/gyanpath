import { randomUUID } from 'node:crypto'
import { getRedis } from '../config/redis.js'

// Relying Party config. CLIENT_ORIGIN / WEBAUTHN_ORIGIN may list several origins (e.g.
// localhost plus a LAN IP), so we parse them into arrays — WebAuthn verification accepts a
// list for expectedOrigin / expectedRPID. The rpID passed when *generating* options must be a
// single value, so we use the first origin's hostname (override with WEBAUTHN_RP_ID in prod).
export const RP_NAME = 'GyanPath'

const hostnameOf = (origin) => {
  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}

export const EXPECTED_ORIGINS = (process.env.WEBAUTHN_ORIGIN || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export const EXPECTED_RP_IDS = [...new Set(EXPECTED_ORIGINS.map(hostnameOf))]
export const RP_ID = process.env.WEBAUTHN_RP_ID || EXPECTED_RP_IDS[0] || 'localhost'

const CHALLENGE_TTL_SECONDS = 5 * 60

// Registration challenges are keyed by the authenticated user; authentication
// challenges are pre-auth so they get an opaque handle returned to the client.
function regKey(userId) {
  return `webauthn:reg:${userId}`
}
function authKey(handle) {
  return `webauthn:auth:${handle}`
}

export async function storeRegChallenge(userId, challenge) {
  await getRedis().set(regKey(userId), challenge, 'EX', CHALLENGE_TTL_SECONDS)
}
export async function takeRegChallenge(userId) {
  const redis = getRedis()
  const challenge = await redis.get(regKey(userId))
  if (challenge) await redis.del(regKey(userId))
  return challenge
}

export async function storeAuthChallenge(challenge) {
  const handle = randomUUID()
  await getRedis().set(authKey(handle), challenge, 'EX', CHALLENGE_TTL_SECONDS)
  return handle
}
export async function takeAuthChallenge(handle) {
  const redis = getRedis()
  const challenge = await redis.get(authKey(handle))
  if (challenge) await redis.del(authKey(handle))
  return challenge
}
