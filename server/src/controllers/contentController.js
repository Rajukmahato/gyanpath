import Lesson from '../models/Lesson.js'
import Enrollment from '../models/Enrollment.js'
import { issueSignedUrlToken, resolveSignedUrlToken } from '../services/signedUrlService.js'
import { logAction } from '../services/auditService.js'

export async function getSignedUrl(req, res) {
  const lesson = await Lesson.findById(req.params.lessonId)
  if (!lesson) return res.status(404).json({ error: 'not found' })

  if (!lesson.isPreview) {
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: lesson.courseId,
      status: 'active',
    })

    if (!enrollment) {
      await logAction({
        actor: req.user._id,
        role: req.user.role,
        action: 'content_access_denied',
        resourceType: 'Lesson',
        resourceId: lesson._id,
        ip: req.ip,
        status: 'failure',
      })
      return res.status(403).json({ error: 'not enrolled in this course' })
    }
  }

  const { token, expiresIn } = await issueSignedUrlToken(String(req.user._id), String(lesson._id))

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'content_access_granted',
    resourceType: 'Lesson',
    resourceId: lesson._id,
    ip: req.ip,
    status: 'success',
  })

  res.json({ streamUrl: `/api/content/stream/${token}`, expiresIn })
}

export async function streamContent(req, res) {
  const resolved = await resolveSignedUrlToken(req.params.token)
  if (!resolved) return res.status(403).json({ error: 'invalid or expired link' })

  const lesson = await Lesson.findById(resolved.lessonId)
  if (!lesson) return res.status(404).json({ error: 'not found' })

  // actual file/object-storage delivery (S3 presigned redirect or local byte-range stream)
  // is wired up once video uploads exist; this endpoint enforces and proves the access
  // control contract the signed URL exists for.
  res.json({ granted: true, lessonId: lesson._id, videoObjectKey: lesson.videoObjectKey })
}
