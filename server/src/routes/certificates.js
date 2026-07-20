import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listMine, verify, download } from '../controllers/certificateController.js'

const router = Router()

router.get('/mine', requireAuth, listMine)
router.get('/:certificateId/verify', verify)
router.get('/:certificateId/download', requireAuth, download)

export default router
