import { randomUUID } from 'node:crypto'
import { getRedis } from '../config/redis.js'

const TOKEN_TTL_SECONDS = 5 * 60

function tokenKey(token) {
  return `signedurl:${token}`
}

export async function issueSignedUrlToken(userId, lessonId) {
  const token = randomUUID()
  await getRedis().set(tokenKey(token), JSON.stringify({ userId, lessonId }), 'EX', TOKEN_TTL_SECONDS)
  return { token, expiresIn: TOKEN_TTL_SECONDS }
}

export async function resolveSignedUrlToken(token) {
  const raw = await getRedis().get(tokenKey(token))
  if (!raw) return null
  return JSON.parse(raw)
}
