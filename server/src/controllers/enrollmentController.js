import Enrollment from '../models/Enrollment.js'
import Lesson from '../models/Lesson.js'
import Payment from '../models/Payment.js'
import { getStripe } from '../config/stripe.js'
import { logAction } from '../services/auditService.js'

const REFUND_WINDOW_DAYS = 7
const REFUND_PROGRESS_THRESHOLD = 0.2

export async function listMyEnrollments(req, res) {
  const enrollments = await Enrollment.find({ userId: req.user._id }).populate('courseId', 'title thumbnailUrl').lean()
  res.json(enrollments)
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

  await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId })

  payment.status = 'refunded'
  payment.refundedAt = new Date()
  await payment.save()

  enrollment.status = 'refunded'
  await enrollment.save()

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
