import Lesson from '../models/Lesson.js'
import Course from '../models/Course.js'
import Enrollment from '../models/Enrollment.js'
import { issueIfEligible } from '../services/certificateService.js'

const COMPLETION_THRESHOLD = 0.9

export async function pingProgress(req, res) {
  const { watchedSecondsDelta } = req.body
  if (!(watchedSecondsDelta > 0)) {
    return res.status(400).json({ error: 'watchedSecondsDelta must be a positive number' })
  }

  const lesson = await Lesson.findById(req.params.lessonId)
  if (!lesson) return res.status(404).json({ error: 'not found' })

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId: lesson.courseId, status: 'active' })
  if (!enrollment) return res.status(403).json({ error: 'not enrolled in this course' })

  let entry = enrollment.progress.find((p) => String(p.lessonId) === String(lesson._id))
  if (!entry) {
    entry = { lessonId: lesson._id, watchedSeconds: 0, completed: false }
    enrollment.progress.push(entry)
    entry = enrollment.progress[enrollment.progress.length - 1]
  }

  const cap = lesson.durationSec || Infinity
  entry.watchedSeconds = Math.min(entry.watchedSeconds + watchedSecondsDelta, cap)
  entry.lastPingAt = new Date()
  if (lesson.durationSec && entry.watchedSeconds >= lesson.durationSec * COMPLETION_THRESHOLD) {
    entry.completed = true
  }

  await enrollment.save()

  let certificate = null
  const course = await Course.findById(lesson.courseId)
  if (course) certificate = await issueIfEligible(enrollment, req.user, course)

  res.json({
    watchedSeconds: entry.watchedSeconds,
    completed: entry.completed,
    certificateIssued: !!certificate,
    certificateId: certificate?.certificateId,
  })
}
