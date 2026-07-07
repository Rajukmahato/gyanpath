import { randomUUID } from 'node:crypto'
import { getRedis } from '../config/redis.js'

// Relying Party config. On localhost the rpID is the bare hostname and the expected
// origin is the client's origin. In production set WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN.
export const RP_NAME = 'GyanPath'
export const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
export const ORIGIN = process.env.WEBAUTHN_ORIGIN || process.env.CLIENT_ORIGIN || 'http://localhost:5173'

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
