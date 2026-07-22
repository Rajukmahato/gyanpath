import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  getProfile,
  updateProfile,
  exportData,
  exportDataJson,
  importData,
  deleteAccount,
  uploadAvatar,
  serveAvatar,
  getPayoutDetails,
  listUnverifiedInstructors,
  verifyInstructor,
} from '../controllers/userController.js'

const router = Router()

router.get('/me', requireAuth, getProfile)
router.patch('/me', requireAuth, updateProfile)
router.get('/me/export', requireAuth, exportData)
router.get('/me/export.json', requireAuth, exportDataJson)
router.post('/me/import', requireAuth, importData)
router.delete('/me', requireAuth, deleteAccount)
router.post('/me/avatar', requireAuth, uploadAvatar)
router.get('/avatars/:filename', serveAvatar)
router.get('/me/payout-details', requireAuth, requireRole('instructor'), getPayoutDetails)
router.get('/instructors/pending', requireAuth, requireRole('moderator', 'admin'), listUnverifiedInstructors)
router.post('/instructors/:id/verify', requireAuth, requireRole('moderator', 'admin'), verifyInstructor)

export default router
