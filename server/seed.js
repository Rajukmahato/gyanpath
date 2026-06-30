import 'dotenv/config'
import { connectDB, disconnectDB } from './src/config/db.js'
import { hashPassword } from './src/utils/password.js'
import { encrypt } from './src/utils/encryption.js'
import User from './src/models/User.js'
import Course from './src/models/Course.js'
import Lesson from './src/models/Lesson.js'
import Enrollment from './src/models/Enrollment.js'

async function clear() {
  await Promise.all(
    [User, Course, Lesson, Enrollment].map((model) => model.deleteMany({})),
  )
}

async function run() {
  await connectDB()
  await clear()

  const passwordHash = await hashPassword('Passw0rd!2345')

  const admin = await User.create({
    email: 'admin@gyanpath.test',
    passwordHash,
    role: 'admin',
    profile: { name: 'Admin' },
  })

  const moderator = await User.create({
    email: 'moderator@gyanpath.test',
    passwordHash,
    role: 'moderator',
    profile: { name: 'Moderator' },
  })

  const verifiedInstructor = await User.create({
    email: 'instructor.verified@gyanpath.test',
    passwordHash,
    role: 'instructor',
    instructorVerified: true,
    profile: { name: 'Verified Instructor' },
    payoutDetails: encrypt(JSON.stringify({ bankName: 'NIC Asia', accountNumber: '0123456789' })),
  })

  const pendingInstructor = await User.create({
    email: 'instructor.pending@gyanpath.test',
    passwordHash,
    role: 'instructor',
    instructorVerified: false,
    profile: { name: 'Pending Instructor' },
  })

  const student = await User.create({
    email: 'student@gyanpath.test',
    passwordHash,
    role: 'student',
    profile: { name: 'Student', interests: ['loksewa', 'IELTS'] },
  })

  const course = await Course.create({
    instructorId: verifiedInstructor._id,
    title: 'Loksewa Prep — General Knowledge',
    description: 'Civil service exam prep covering general knowledge and current affairs.',
    category: 'loksewa',
    priceNPR: 1200,
    status: 'approved',
  })

  const draftCourse = await Course.create({
    instructorId: pendingInstructor._id,
    title: 'IELTS Speaking Bootcamp',
    description: 'Awaiting moderator review.',
    category: 'IELTS',
    priceNPR: 1500,
    status: 'pending',
  })

  const lessons = await Lesson.insertMany([
    { courseId: course._id, title: 'Intro & Exam Pattern', order: 1, isPreview: true, durationSec: 600 },
    { courseId: course._id, title: 'Current Affairs — Nepal', order: 2, isPreview: false, durationSec: 1800 },
    { courseId: course._id, title: 'Practice Set 1', order: 3, isPreview: false, durationSec: 1500 },
    { courseId: draftCourse._id, title: 'Speaking Part 1', order: 1, isPreview: true, durationSec: 900 },
  ])

  await Enrollment.create({
    userId: student._id,
    courseId: course._id,
    progress: [
      { lessonId: lessons[0]._id, watchedSeconds: 600, completed: true },
      { lessonId: lessons[1]._id, watchedSeconds: 300, completed: false },
    ],
  })

  console.log('seeded:', {
    admin: admin.email,
    moderator: moderator.email,
    verifiedInstructor: verifiedInstructor.email,
    pendingInstructor: pendingInstructor.email,
    student: student.email,
    courses: [course.title, draftCourse.title],
  })

  await disconnectDB()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
