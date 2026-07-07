import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { loginLimiter, otpLimiter, passwordResetLimiter, signupLimiter } from '../middleware/rateLimit.js'
import {
  register,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  login,
  verifyMfaLogin,
  setupMfa,
  enableMfa,
  disableMfa,
  refresh,
  me,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  changeExpiredPassword,
} from '../controllers/authController.js'
import {
  registerOptions,
  registerVerify,
  loginOptions,
  loginVerify,
  listPasskeys,
  deletePasskey,
} from '../controllers/webauthnController.js'

const router = Router()

router.post('/register', signupLimiter, register)
router.post('/otp/verify', otpLimiter, verifyRegistrationOtp)
router.post('/otp/resend', otpLimiter, resendRegistrationOtp)
router.post('/login', loginLimiter, login)
router.post('/mfa/login-verify', loginLimiter, verifyMfaLogin)
router.post('/mfa/setup', requireAuth, setupMfa)
router.post('/mfa/enable', requireAuth, enableMfa)
router.post('/mfa/disable', requireAuth, disableMfa)
router.post('/refresh', refresh)
router.get('/me', requireAuth, me)
router.post('/logout', logout)
router.post('/password-reset/request', passwordResetLimiter, requestPasswordReset)
router.post('/password-reset/confirm', passwordResetLimiter, confirmPasswordReset)
router.post('/password/change-expired', passwordResetLimiter, changeExpiredPassword)

// WebAuthn / passkeys (advanced, passwordless authentication)
router.post('/webauthn/register/options', requireAuth, registerOptions)
router.post('/webauthn/register/verify', requireAuth, registerVerify)
router.post('/webauthn/login/options', loginLimiter, loginOptions)
router.post('/webauthn/login/verify', loginLimiter, loginVerify)
router.get('/webauthn/passkeys', requireAuth, listPasskeys)
router.delete('/webauthn/passkeys/:id', requireAuth, deletePasskey)

export default router
