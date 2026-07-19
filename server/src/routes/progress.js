import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pingProgress } from '../controllers/progressController.js'

const router = Router()

router.post('/:lessonId/ping', requireAuth, pingProgress)

export default router
