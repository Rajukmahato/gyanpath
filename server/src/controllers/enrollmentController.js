import Enrollment from '../models/Enrollment.js'
import Lesson from '../models/Lesson.js'
import Payment from '../models/Payment.js'
import { logAction } from '../services/auditService.js'
import { flagBurst } from '../services/alertService.js'

const REFUND_WINDOW_DAYS = 7
const REFUND_PROGRESS_THRESHOLD = 0.2
const REFUND_BURST_WINDOW_SECONDS = 24 * 60 * 60
const REFUND_BURST_THRESHOLD = 3

export async function getMyEnrollmentForCourse(req, res) {
  const enrollment = await Enrollment.findOne({
    userId: req.user._id,
    courseId: req.params.courseId,
    status: 'active',
  }).lean()
  res.json({ enrolled: !!enrollment, progress: enrollment?.progress || [] })
}

export async function listMyEnrollments(req, res) {
  const enrollments = await Enrollment.find({ userId: req.user._id }).populate('courseId', 'title thumbnailUrl category').lean()

  const withProgress = await Promise.all(
    enrollments.map(async (e) => {
      const totalLessons = await Lesson.countDocuments({ courseId: e.courseId?._id })
      const completedLessons = (e.progress || []).filter((p) => p.completed).length
      const firstLesson = await Lesson.findOne({ courseId: e.courseId?._id }).sort('order').select('_id').lean()
      return { ...e, totalLessons, completedLessons, firstLessonId: firstLesson?._id }
    }),
  )

  res.json(withProgress)
}

export async function requestRefund(req, res) {
  const enrollment = await Enrollment.findOne({ _id: req.params.id, userId: req.user._id, status: 'active' })
  if (!enrollment) return res.status(404).json({ error: 'not found' })

  const ageDays = (Date.now() - enrollment.purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays > REFUND_WINDOW_DAYS) {
    return res.status(400).json({ error: `refund window of ${REFUND_WINDOW_DAYS} days has passed` })
  }

  const totalLessons = await Lesson.countDocuments({ courseId: enrollment.courseId })
  const completedLessons = enrollment.progress.filter((p) => p.completed).length
  const progressRatio = totalLessons > 0 ? completedLessons / totalLessons : 0

  if (progressRatio >= REFUND_PROGRESS_THRESHOLD) {
    return res.status(400).json({ error: 'too much of the course has been watched to qualify for a refund' })
  }

  const payment = await Payment.findOne({ userId: req.user._id, courseId: enrollment.courseId, status: 'succeeded' })
  if (!payment) return res.status(400).json({ error: 'no completed payment found for this enrollment' })

  // eSewa refunds are settled out-of-band by the merchant; we record the reversal and
  // revoke access here, and the payout/finance side handles the actual money movement
  payment.status = 'refunded'
  payment.refundedAt = new Date()
  await payment.save()

  enrollment.status = 'refunded'
  await enrollment.save()

  await flagBurst(`refundburst:${req.user._id}`, {
    windowSeconds: REFUND_BURST_WINDOW_SECONDS,
    threshold: REFUND_BURST_THRESHOLD,
    message: `Unusual refund volume for user ${req.user.email} — ${REFUND_BURST_THRESHOLD}+ refunds in 24h`,
  })

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'refund',
    resourceType: 'Enrollment',
    resourceId: enrollment._id,
    ip: req.ip,
    status: 'success',
  })

  res.json({ message: 'refund processed' })
}
