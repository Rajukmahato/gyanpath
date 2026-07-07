import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import Course from '../models/Course.js'
import Lesson from '../models/Lesson.js'
import Enrollment from '../models/Enrollment.js'
import { logAction } from '../services/auditService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.resolve(__dirname, '../../uploads/videos')
const THUMB_DIR = path.resolve(__dirname, '../../uploads/thumbnails')
fs.mkdirSync(VIDEO_DIR, { recursive: true })
fs.mkdirSync(THUMB_DIR, { recursive: true })

const videoStorage = multer.diskStorage({
  destination: VIDEO_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4'
    cb(null, `${req.user._id}_${Date.now()}${ext}`)
  },
})

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) return cb(new Error('Only video files allowed'))
    cb(null, true)
  },
}).single('video')

const thumbStorage = multer.diskStorage({
  destination: THUMB_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${req.params.id}${ext}`)
  },
})

const thumbUpload = multer({
  storage: thumbStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'))
    cb(null, true)
  },
}).single('thumbnail')

export async function listPublicCourses(req, res) {
  const { category } = req.query
  const filter = { status: 'approved' }
  if (category) filter.category = String(category)

  const courses = await Course.find(filter).select('-instructorId').lean()
  res.json(courses)
}

export async function getPublicCourse(req, res) {
  const course = await Course.findOne({ _id: req.params.id, status: 'approved' }).lean()
  if (!course) return res.status(404).json({ error: 'not found' })

  const lessons = await Lesson.find({ courseId: course._id })
    .select('title order isPreview durationSec')
    .sort('order')
    .lean()

  res.json({ ...course, lessons })
}

export async function createCourse(req, res) {
  const { title, description, category, priceNPR } = req.body
  const course = await Course.create({
    instructorId: req.user._id,
    title,
    description,
    category,
    priceNPR,
  })
  res.status(201).json(course)
}

export async function listMyCourses(req, res) {
  const courses = await Course.find({ instructorId: req.user._id }).sort('-createdAt').lean()

  const withDetail = await Promise.all(
    courses.map(async (c) => {
      const lessons = await Lesson.find({ courseId: c._id }).sort('order').select('title order isPreview youtubeId videoObjectKey durationSec').lean()
      const students = await Enrollment.countDocuments({ courseId: c._id, status: 'active' })
      return { ...c, lessons, students }
    }),
  )

  res.json(withDetail)
}

export async function updateMyCourse(req, res) {
  const course = await Course.findOne({ _id: req.params.id, instructorId: req.user._id })
  if (!course) return res.status(404).json({ error: 'not found' })

  const allowed = ['title', 'description', 'category', 'priceNPR', 'thumbnailUrl']
  for (const field of allowed) {
    if (field in req.body) course[field] = req.body[field]
  }
  // editing an approved course sends it back for re-review
  if (course.status === 'approved') course.status = 'pending'

  await course.save()
  res.json(course)
}

export async function submitCourseForReview(req, res) {
  const course = await Course.findOne({ _id: req.params.id, instructorId: req.user._id })
  if (!course) return res.status(404).json({ error: 'not found' })
  if (course.status !== 'draft') return res.status(400).json({ error: 'only draft courses can be submitted' })

  course.status = 'pending'
  await course.save()
  res.json(course)
}

export async function addLesson(req, res) {
  const course = await Course.findOne({ _id: req.params.id, instructorId: req.user._id })
  if (!course) return res.status(404).json({ error: 'not found' })

  const { title, order, isPreview, durationSec, youtubeId, videoObjectKey, captionsUrl, transcript, audioObjectKey } = req.body
  const lesson = await Lesson.create({
    courseId: course._id,
    title,
    order,
    isPreview: !!isPreview,
    durationSec,
    youtubeId,
    videoObjectKey,
    captionsUrl,
    transcript,
    audioObjectKey,
  })

  // give the course a cover image from its first video lesson, if it has none yet
  if (youtubeId && !course.thumbnailUrl) {
    course.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    await course.save()
  }

  res.status(201).json(lesson)
}

export async function listPendingCourses(req, res) {
  const courses = await Course.find({ status: 'pending' }).populate('instructorId', 'email profile.name').lean()
  res.json(courses)
}

export async function reviewCourse(req, res) {
  const { decision } = req.body // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approved or rejected' })
  }

  const course = await Course.findById(req.params.id)
  if (!course) return res.status(404).json({ error: 'not found' })

  course.status = decision
  await course.save()

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'course_review',
    resourceType: 'Course',
    resourceId: course._id,
    ip: req.ip,
    status: decision,
  })

  res.json(course)
}

// POST /courses/:id/upload-video  — instructor uploads an MP4 for a lesson
export function uploadLessonVideo(req, res) {
  videoUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
    const objectKey = req.file.filename
    res.json({ videoObjectKey: objectKey, url: `/api/courses/videos/${objectKey}` })
  })
}

// GET /courses/videos/:filename  — serve a stored lesson video
export function serveLessonVideo(req, res) {
  const filename = path.basename(req.params.filename)
  const filePath = path.join(VIDEO_DIR, filename)
  if (!fs.existsSync(filePath)) return res.status(404).end()
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.sendFile(filePath)
}

// POST /courses/:id/upload-thumbnail  — instructor uploads a custom course cover image
export function uploadCourseThumbnail(req, res) {
  thumbUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

    const course = await Course.findOne({ _id: req.params.id, instructorId: req.user._id })
    if (!course) return res.status(404).json({ error: 'not found' })

    const thumbnailUrl = `/api/courses/thumbnails/${req.file.filename}`
    course.thumbnailUrl = thumbnailUrl
    await course.save()
    res.json({ thumbnailUrl })
  })
}

// GET /courses/thumbnails/:filename  — serve a stored thumbnail
export function serveCourseThumbnail(req, res) {
  const filename = path.basename(req.params.filename)
  const filePath = path.join(THUMB_DIR, filename)
  if (!fs.existsSync(filePath)) return res.status(404).end()
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.sendFile(filePath)
}
