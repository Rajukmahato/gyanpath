import mongoose from 'mongoose'

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    bio: { type: String, trim: true },
    interests: [{ type: String, trim: true }],
    language: { type: String, enum: ['en', 'ne'], default: 'en' },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['student', 'instructor', 'moderator', 'admin'],
      default: 'student',
    },
    mfaSecret: { type: String },
    mfaEnabled: { type: Boolean, default: false },
    profile: { type: profileSchema, default: () => ({}) },
    payoutDetails: { type: String }, // AES-256-GCM encrypted JSON, instructors only
    instructorVerified: { type: Boolean, default: false },
    recentPasswordHashes: { type: [String], default: [] },
  },
  { timestamps: true },
)

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ phone: 1 }, { unique: true, sparse: true })

export default mongoose.model('User', userSchema)
