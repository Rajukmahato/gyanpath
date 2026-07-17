import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    provider: { type: String, enum: ['khalti', 'esewa', 'dev'], default: 'khalti' },
    // our unique order id per payment (eSewa transaction_uuid / Khalti purchase_order_id)
    transactionUuid: { type: String, required: true },
    // Khalti payment identifier (pidx), looked up to verify status
    pidx: { type: String, index: true },
    // the gateway's own reference for a completed transaction, kept for reconciliation
    providerRef: { type: String },
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

// unique only among real payments — a partial filter so any legacy rows without a
// transactionUuid don't block the index from building
paymentSchema.index(
  { transactionUuid: 1 },
  { unique: true, partialFilterExpression: { transactionUuid: { $type: 'string' } } },
)

export default mongoose.model('Payment', paymentSchema)
