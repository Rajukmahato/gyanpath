import mongoose from 'mongoose'

const certificateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    certificateId: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    signature: { type: String, required: true },
    pdfObjectKey: { type: String },
  },
  { timestamps: true },
)

certificateSchema.index({ certificateId: 1 }, { unique: true })

export default mongoose.model('Certificate', certificateSchema)
