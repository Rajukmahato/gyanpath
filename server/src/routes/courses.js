import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  listPublicCourses,
  getPublicCourse,
  createCourse,
  listMyCourses,
  updateMyCourse,
  submitCourseForReview,
  addLesson,
  listPendingCourses,
  reviewCourse,
} from '../controllers/courseController.js'
import { checkout } from '../controllers/paymentController.js'

const router = Router()

router.get('/', listPublicCourses)
router.get('/pending', requireAuth, requireRole('moderator', 'admin'), listPendingCourses)
router.get('/mine', requireAuth, requireRole('instructor'), listMyCourses)
router.get('/:id', getPublicCourse)

router.post('/', requireAuth, requireRole('instructor'), createCourse)
router.patch('/:id', requireAuth, requireRole('instructor'), updateMyCourse)
router.post('/:id/submit', requireAuth, requireRole('instructor'), submitCourseForReview)
router.post('/:id/lessons', requireAuth, requireRole('instructor'), addLesson)
router.post('/:id/review', requireAuth, requireRole('moderator', 'admin'), reviewCourse)
router.post('/:id/checkout', requireAuth, checkout)

export default router
