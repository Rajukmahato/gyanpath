import mongoose from 'mongoose'

const lessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    videoObjectKey: { type: String },
    durationSec: { type: Number, min: 0 },
    isPreview: { type: Boolean, default: false },
    captionsUrl: { type: String },
  },
  { timestamps: true },
)

lessonSchema.index({ courseId: 1, order: 1 })

export default mongoose.model('Lesson', lessonSchema)
