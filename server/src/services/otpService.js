import crypto from 'node:crypto'
import { getRedis } from '../config/redis.js'

const OTP_TTL_SECONDS = 5 * 60

function otpKey(identifier) {
  return `otp:${identifier}`
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function issueOtp(identifier) {
  const code = crypto.randomInt(100000, 999999).toString()
  await getRedis().set(otpKey(identifier), hashCode(code), 'EX', OTP_TTL_SECONDS)
  return code
}

export async function verifyOtp(identifier, code) {
  const redis = getRedis()
  const stored = await redis.get(otpKey(identifier))
  if (!stored || stored !== hashCode(code)) return false
  await redis.del(otpKey(identifier))
  return true
}
