import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { requireIpAllowlist } from '../middleware/ipAllowlist.js'
import { listUsers, deleteUser, listAuditLogs, changeUserRole } from '../controllers/adminController.js'

const router = Router()

// admin endpoints are IP-restricted (when ADMIN_IP_ALLOWLIST is configured) on top of
// requiring the admin role — defence in depth for the most sensitive routes
router.use(requireIpAllowlist('ADMIN_IP_ALLOWLIST'), requireAuth, requireRole('admin'))

router.get('/users', listUsers)
router.delete('/users/:id', deleteUser)
router.patch('/users/:id/role', changeUserRole)
router.get('/audit-logs', listAuditLogs)

export default router
