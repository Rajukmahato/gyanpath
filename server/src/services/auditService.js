import AuditLog from '../models/AuditLog.js'

const MASKED_FIELDS = ['password', 'passwordHash', 'cardNumber', 'cvv', 'token']

function mask(metadata = {}) {
  const masked = { ...metadata }
  for (const field of MASKED_FIELDS) {
    if (field in masked) masked[field] = '***'
  }
  return masked
}

export async function logAction({ actor, role, action, resourceType, resourceId, ip, status, metadata }) {
  await AuditLog.create({
    actor: actor ? String(actor) : 'anonymous',
    role,
    action,
    resourceType,
    resourceId,
    ip,
    status,
    metadata: mask(metadata),
  })
}
