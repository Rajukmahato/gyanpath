import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import Enrollment from '../models/Enrollment.js'
import Certificate from '../models/Certificate.js'
import { revokeAllUserSessions } from '../services/tokenService.js'
import { logAction } from '../services/auditService.js'

// GET /api/admin/users?search=&role=&page=&limit=
export async function listUsers(req, res) {
  const { search, role, page = 1, limit = 20 } = req.query
  const filter = {}
  if (role) filter.role = role
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ email: re }, { 'profile.name': re }]
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('email role profile.name emailVerified mfaEnabled createdAt instructorVerified avatarUrl')
      .sort('-createdAt')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter),
  ])

  res.json({ users, total, page: Number(page), limit: Number(limit) })
}

// DELETE /api/admin/users/:id
export async function deleteUser(req, res) {
  const { id } = req.params
  if (String(id) === String(req.user._id)) {
    return res.status(400).json({ error: 'cannot delete your own account' })
  }

  const user = await User.findById(id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  await revokeAllUserSessions(id)
  await Promise.all([
    Enrollment.deleteMany({ userId: id }),
    Certificate.deleteMany({ userId: id }),
    User.deleteOne({ _id: id }),
  ])

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'admin_delete_user',
    resourceType: 'User',
    resourceId: id,
    ip: req.ip,
    status: 'success',
    metadata: { deletedEmail: user.email },
  })

  res.json({ message: 'user deleted' })
}

// GET /api/admin/audit-logs?action=&actor=&page=&limit=
export async function listAuditLogs(req, res) {
  const { action, actor, status, page = 1, limit = 50 } = req.query
  const filter = {}
  if (action) filter.action = action
  if (actor) filter.actor = actor
  if (status) filter.status = status

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort('-timestamp')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    AuditLog.countDocuments(filter),
  ])

  res.json({ logs, total, page: Number(page), limit: Number(limit) })
}

// PATCH /api/admin/users/:id/role
export async function changeUserRole(req, res) {
  const { role } = req.body
  const allowed = ['student', 'instructor', 'moderator', 'admin']
  if (!allowed.includes(role)) return res.status(400).json({ error: 'invalid role' })

  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const oldRole = user.role
  user.role = role
  await user.save()

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'admin_change_role',
    resourceType: 'User',
    resourceId: user._id,
    ip: req.ip,
    status: 'success',
    metadata: { from: oldRole, to: role },
  })

  res.json({ id: user._id, email: user.email, role: user.role })
}
