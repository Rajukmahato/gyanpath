import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getSignedUrl, streamContent } from '../controllers/contentController.js'

const router = Router()

router.post('/:lessonId/signed-url', requireAuth, getSignedUrl)
router.get('/stream/:token', streamContent)

export default router
