import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  actor: { type: String, required: true }, // userId or "anonymous"
  role: { type: String },
  action: { type: String, required: true },
  resourceType: { type: String },
  resourceId: { type: String },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now },
  status: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }, // payment fields must be masked before writing here
})

auditLogSchema.index({ actor: 1, timestamp: -1 })
auditLogSchema.index({ action: 1, timestamp: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
