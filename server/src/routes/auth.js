import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { loginLimiter, otpLimiter, passwordResetLimiter, signupLimiter } from '../middleware/rateLimit.js'
import {
  register,
  verifyRegistrationOtp,
  login,
  verifyMfaLogin,
  setupMfa,
  enableMfa,
  refresh,
  me,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
} from '../controllers/authController.js'

const router = Router()

router.post('/register', signupLimiter, register)
router.post('/otp/verify', otpLimiter, verifyRegistrationOtp)
router.post('/login', loginLimiter, login)
router.post('/mfa/login-verify', loginLimiter, verifyMfaLogin)
router.post('/mfa/setup', requireAuth, setupMfa)
router.post('/mfa/enable', requireAuth, enableMfa)
router.post('/refresh', refresh)
router.get('/me', requireAuth, me)
router.post('/logout', logout)
router.post('/password-reset/request', passwordResetLimiter, requestPasswordReset)
router.post('/password-reset/confirm', passwordResetLimiter, confirmPasswordReset)

export default router
