import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listMyEnrollments, requestRefund } from '../controllers/enrollmentController.js'

const router = Router()

router.get('/mine', requireAuth, listMyEnrollments)
router.post('/:id/refund-request', requireAuth, requestRefund)

export default router
