import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    stripePaymentIntentId: { type: String, required: true },
    amountNPR: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'refunded', 'failed'],
      default: 'pending',
    },
    refundedAt: { type: Date },
  },
  { timestamps: true },
)

paymentSchema.index({ stripePaymentIntentId: 1 }, { unique: true })

export default mongoose.model('Payment', paymentSchema)
