import mongoose from 'mongoose'
import Course from '../models/Course.js'
import Payment from '../models/Payment.js'
import Enrollment from '../models/Enrollment.js'
import { createCoursePaymentIntent, constructWebhookEvent } from '../services/paymentService.js'
import { logAction } from '../services/auditService.js'

export async function checkout(req, res) {
  const course = await Course.findOne({ _id: req.params.id, status: 'approved' })
  if (!course) return res.status(404).json({ error: 'not found' })

  const existing = await Enrollment.findOne({ userId: req.user._id, courseId: course._id, status: 'active' })
  if (existing) return res.status(409).json({ error: 'already enrolled' })

  const paymentIntent = await createCoursePaymentIntent({ course, userId: req.user._id })

  await Payment.create({
    userId: req.user._id,
    courseId: course._id,
    stripePaymentIntentId: paymentIntent.id,
    amountNPR: course.priceNPR,
    status: 'pending',
  })

  res.json({ clientSecret: paymentIntent.client_secret })
}

export async function stripeWebhook(req, res) {
  let event
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature'])
  } catch {
    return res.status(400).json({ error: 'invalid webhook signature' })
  }

  if (event.type === 'payment_intent.succeeded') {
    const stripePaymentIntentId = event.data.object.id
    const payment = await Payment.findOne({ stripePaymentIntentId })

    if (payment && payment.status !== 'succeeded') {
      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          payment.status = 'succeeded'
          await payment.save({ session })

          await Enrollment.findOneAndUpdate(
            { userId: payment.userId, courseId: payment.courseId },
            { $setOnInsert: { userId: payment.userId, courseId: payment.courseId, status: 'active' } },
            { upsert: true, session },
          )
        })
      } finally {
        await session.endSession()
      }

      await logAction({
        actor: payment.userId,
        action: 'payment_succeeded',
        resourceType: 'Payment',
        resourceId: payment._id,
        status: 'success',
        metadata: { courseId: payment.courseId },
      })
    }
  }

  res.json({ received: true })
}
