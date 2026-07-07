import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Lesson from '../models/Lesson.js'
import Course from '../models/Course.js'
import Enrollment from '../models/Enrollment.js'
import { issueSignedUrlToken, resolveSignedUrlToken } from '../services/signedUrlService.js'
import { logAction } from '../services/auditService.js'
import { flagBurst } from '../services/alertService.js'

const SCRAPE_WINDOW_SECONDS = 5 * 60
const SCRAPE_THRESHOLD = 30

const MEDIA_DIR = process.env.MEDIA_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../media')
const FALLBACK_VIDEO = 'sample.mp4'

// map a lesson's stored object key to a real file on disk, defending against path
// traversal (only a bare filename is honored) and falling back to a shared sample
function resolveMediaPath(objectKey) {
  const name = objectKey ? path.basename(objectKey) : FALLBACK_VIDEO
  const candidate = path.join(MEDIA_DIR, name)
  if (fs.existsSync(candidate)) return candidate
  const fallback = path.join(MEDIA_DIR, FALLBACK_VIDEO)
  return fs.existsSync(fallback) ? fallback : null
}

export async function getSignedUrl(req, res) {
  await flagBurst(`contentaccess:${req.ip}`, {
    windowSeconds: SCRAPE_WINDOW_SECONDS,
    threshold: SCRAPE_THRESHOLD,
    message: `Unusual content-access volume from IP ${req.ip} — possible scraping`,
  })

  const lesson = await Lesson.findById(req.params.lessonId)
  if (!lesson) return res.status(404).json({ error: 'not found' })

  if (!lesson.isPreview) {
    // enrolled learners can watch; so can the course's own instructor (to review
    // their material) and admins (to audit) — everyone else is denied
    const [enrollment, course] = await Promise.all([
      Enrollment.findOne({ userId: req.user._id, courseId: lesson.courseId, status: 'active' }),
      Course.findById(lesson.courseId).select('instructorId'),
    ])
    const isOwner = course && String(course.instructorId) === String(req.user._id)
    const isAdmin = req.user.role === 'admin'

    if (!enrollment && !isOwner && !isAdmin) {
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

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'content_access_granted',
    resourceType: 'Lesson',
    resourceId: lesson._id,
    ip: req.ip,
    status: 'success',
  })

  // accessibility payload shared by both providers: captions + transcript for WCAG,
  // exposed only after the enrollment check above
  const accessibility = {
    captionsUrl: lesson.captionsUrl || null,
    transcript: lesson.transcript || null,
  }

  // the YouTube id is only handed out here, after the access check above — so paid
  // lessons still aren't watchable without an enrollment, even though YouTube is public
  if (lesson.youtubeId) {
    return res.json({ provider: 'youtube', youtubeId: lesson.youtubeId, ...accessibility })
  }

  const { token, expiresIn } = await issueSignedUrlToken(String(req.user._id), String(lesson._id))
  // if the instructor uploaded a separate audio-only rendition, hand out a second signed
  // token for it so low-bandwidth learners can stream just the audio
  let audioStreamUrl = null
  if (lesson.audioObjectKey) {
    const audio = await issueSignedUrlToken(String(req.user._id), String(lesson._id))
    audioStreamUrl = `/api/content/stream/${audio.token}?audio=1`
  }
  res.json({ provider: 'file', streamUrl: `/api/content/stream/${token}`, audioStreamUrl, expiresIn, ...accessibility })
}

export async function streamContent(req, res) {
  const resolved = await resolveSignedUrlToken(req.params.token)
  if (!resolved) return res.status(403).json({ error: 'invalid or expired link' })

  const lesson = await Lesson.findById(resolved.lessonId)
  if (!lesson) return res.status(404).json({ error: 'not found' })

  // low-bandwidth audio-only rendition, when requested and available
  const wantAudio = req.query.audio === '1' && lesson.audioObjectKey
  const objectKey = wantAudio ? lesson.audioObjectKey : lesson.videoObjectKey
  const filePath = resolveMediaPath(objectKey)
  if (!filePath) return res.status(404).json({ error: 'video not available' })

  const { size } = fs.statSync(filePath)
  // the signed token is single-use-ish and scoped to this user; the file itself must
  // never be cached by shared proxies
  res.setHeader('Content-Type', wantAudio ? 'audio/mpeg' : 'video/mp4')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'private, no-store')
  // the client runs on a different origin (5173 vs 4000), so the <video> element can
  // only embed this stream if we relax helmet's default same-origin resource policy here
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  const range = req.headers.range
  if (range) {
    // HTTP range request — respond with just the requested slice so the <video>
    // element can seek and stream progressively instead of downloading everything
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    const start = match && match[1] ? parseInt(match[1], 10) : 0
    const end = match && match[2] ? parseInt(match[2], 10) : size - 1

    if (start >= size || end >= size || start > end) {
      res.setHeader('Content-Range', `bytes */${size}`)
      return res.status(416).end()
    }

    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    res.setHeader('Content-Length', end - start + 1)
    return fs.createReadStream(filePath, { start, end }).pipe(res)
  }

  res.status(200)
  res.setHeader('Content-Length', size)
  return fs.createReadStream(filePath).pipe(res)
}
