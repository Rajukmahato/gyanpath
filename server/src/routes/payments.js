import { Router } from 'express'
import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { esewaCallback, confirmEsewaPayment, confirmKhaltiPayment } from '../controllers/paymentController.js'

const router = Router()

// Khalti (primary): after the user returns, the client confirms by looking up the pidx
router.post('/khalti/confirm', requireAuth, requireRole('student'), confirmKhaltiPayment)

// eSewa (alternative): browser callback (GET ?data / POST form) + status-API confirm
router.get('/esewa/callback', esewaCallback)
router.post('/esewa/callback', express.urlencoded({ extended: false }), esewaCallback)
router.post('/esewa/confirm', requireAuth, requireRole('student'), confirmEsewaPayment)

export default router
