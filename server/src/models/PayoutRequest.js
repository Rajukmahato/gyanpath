import mongoose from 'mongoose'

const payoutRequestSchema = new mongoose.Schema(
  {
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountNPR: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true },
)

payoutRequestSchema.index({ instructorId: 1 })
payoutRequestSchema.index({ status: 1 })

export default mongoose.model('PayoutRequest', payoutRequestSchema)
