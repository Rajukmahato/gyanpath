import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { requestPayout, listMyPayouts, listPendingPayouts, reviewPayout } from '../controllers/payoutController.js'

const router = Router()

router.post('/', requireAuth, requireRole('instructor'), requestPayout)
router.get('/mine', requireAuth, requireRole('instructor'), listMyPayouts)
router.get('/pending', requireAuth, requireRole('admin'), listPendingPayouts)
router.post('/:id/review', requireAuth, requireRole('admin'), reviewPayout)

export default router
