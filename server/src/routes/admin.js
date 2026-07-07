import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { listUsers, deleteUser, listAuditLogs, changeUserRole } from '../controllers/adminController.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get('/users', listUsers)
router.delete('/users/:id', deleteUser)
router.patch('/users/:id/role', changeUserRole)
router.get('/audit-logs', listAuditLogs)

export default router
