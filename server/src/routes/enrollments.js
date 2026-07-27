import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listMyEnrollments, getMyEnrollmentForCourse, requestRefund } from '../controllers/enrollmentController.js'

const router = Router()

router.get('/mine', requireAuth, listMyEnrollments)
router.get('/course/:courseId', requireAuth, getMyEnrollmentForCourse)
router.post('/:id/refund-request', requireAuth, requestRefund)

export default router
