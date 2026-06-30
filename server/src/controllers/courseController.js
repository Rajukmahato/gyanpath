import Course from '../models/Course.js'
import Lesson from '../models/Lesson.js'
import { logAction } from '../services/auditService.js'

export async function listPublicCourses(req, res) {
  const { category } = req.query
  const filter = { status: 'approved' }
  if (category) filter.category = category

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
  const courses = await Course.find({ instructorId: req.user._id }).lean()
  res.json(courses)
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

  const { title, order, isPreview, durationSec, videoObjectKey, captionsUrl } = req.body
  const lesson = await Lesson.create({
    courseId: course._id,
    title,
    order,
    isPreview: !!isPreview,
    durationSec,
    videoObjectKey,
    captionsUrl,
  })
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
