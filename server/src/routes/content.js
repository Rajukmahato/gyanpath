import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { contentLimiter } from '../middleware/rateLimit.js'
import { getSignedUrl, streamContent } from '../controllers/contentController.js'

const router = Router()

router.post('/:lessonId/signed-url', contentLimiter, requireAuth, getSignedUrl)
router.get('/stream/:token', streamContent)

export default router
