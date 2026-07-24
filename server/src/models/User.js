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

// a registered WebAuthn/passkey authenticator (FIDO2). publicKey is stored base64url-encoded.
const passkeySchema = new mongoose.Schema(
  {
    credentialId: { type: String, required: true }, // base64url credential id
    publicKey: { type: String, required: true }, // base64 of the COSE public key bytes
    counter: { type: Number, default: 0 },
    transports: { type: [String], default: [] },
    name: { type: String, default: 'Passkey' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['student', 'instructor', 'moderator', 'admin'],
      default: 'student',
    },
    mfaSecret: { type: String },
    mfaEnabled: { type: Boolean, default: false },
    // set when the account was created or linked via a third-party OAuth provider (e.g. 'google')
    oauthProvider: { type: String },
    passkeys: { type: [passkeySchema], default: [] },
    profile: { type: profileSchema, default: () => ({}) },
    avatarUrl: { type: String },
    payoutDetails: { type: String }, // AES-256-GCM encrypted JSON, instructors only
    instructorVerified: { type: Boolean, default: false },
    recentPasswordHashes: { type: [String], default: [] },
    // when the current password was set; drives the 90-day forced-rotation policy
    passwordChangedAt: { type: Date, default: Date.now },
    deletionRequestedAt: { type: Date },
  },
  { timestamps: true },
)

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ phone: 1 }, { unique: true, sparse: true })

export default mongoose.model('User', userSchema)
