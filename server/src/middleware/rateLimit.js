import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { getRedis } from '../config/redis.js'

export function createRateLimiter({ windowMs, max, prefix, message = 'too many requests' }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args) => getRedis().call(...args),
    }),
  })
}

export const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, prefix: 'login' })
export const otpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, prefix: 'otp' })
export const passwordResetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, prefix: 'pwreset' })
export const signupLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, prefix: 'signup' })
