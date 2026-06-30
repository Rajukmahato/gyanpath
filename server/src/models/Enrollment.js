import mongoose from 'mongoose'

const progressEntrySchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    watchedSeconds: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    lastPingAt: { type: Date },
  },
  { _id: false },
)

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    purchasedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'refunded'], default: 'active' },
    progress: { type: [progressEntrySchema], default: [] },
  },
  { timestamps: true },
)

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

export default mongoose.model('Enrollment', enrollmentSchema)
