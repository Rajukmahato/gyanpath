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
  uploadLessonVideo,
  serveLessonVideo,
  uploadCourseThumbnail,
  serveCourseThumbnail,
} from '../controllers/courseController.js'
import { checkout } from '../controllers/paymentController.js'

const router = Router()

// Static file serving (no auth — files are opaque UUIDs, not guessable)
router.get('/videos/:filename', serveLessonVideo)
router.get('/thumbnails/:filename', serveCourseThumbnail)

router.get('/', listPublicCourses)
router.get('/pending', requireAuth, requireRole('moderator', 'admin'), listPendingCourses)
router.get('/mine', requireAuth, requireRole('instructor'), listMyCourses)
router.get('/:id', getPublicCourse)

router.post('/', requireAuth, requireRole('instructor'), createCourse)
router.patch('/:id', requireAuth, requireRole('instructor'), updateMyCourse)
router.post('/:id/submit', requireAuth, requireRole('instructor'), submitCourseForReview)
router.post('/:id/lessons', requireAuth, requireRole('instructor'), addLesson)
router.post('/:id/review', requireAuth, requireRole('moderator', 'admin'), reviewCourse)
router.post('/:id/checkout', requireAuth, requireRole('student'), checkout)
router.post('/:id/upload-video', requireAuth, requireRole('instructor'), uploadLessonVideo)
router.post('/:id/upload-thumbnail', requireAuth, requireRole('instructor'), uploadCourseThumbnail)

export default router
