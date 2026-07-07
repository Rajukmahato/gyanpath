import mongoose from 'mongoose'

const lessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    // a lesson plays either an embedded YouTube video (real course content) or a
    // self-hosted file via signed URL; youtubeId takes priority when present
    youtubeId: { type: String },
    videoObjectKey: { type: String },
    durationSec: { type: Number, min: 0 },
    isPreview: { type: Boolean, default: false },
    // accessibility / low-bandwidth extras (WCAG 2.1): a WebVTT captions file, a plain-text
    // transcript, and an optional audio-only rendition for learners on limited data
    captionsUrl: { type: String },
    transcript: { type: String },
    audioObjectKey: { type: String },
  },
  { timestamps: true },
)

lessonSchema.index({ courseId: 1, order: 1 })

export default mongoose.model('Lesson', lessonSchema)
