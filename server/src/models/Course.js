import mongoose from 'mongoose'

const courseSchema = new mongoose.Schema(
  {
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    priceNPR: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
    },
    thumbnailUrl: { type: String },
  },
  { timestamps: true },
)

courseSchema.index({ instructorId: 1 })
courseSchema.index({ status: 1 })

export default mongoose.model('Course', courseSchema)
