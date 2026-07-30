import 'dotenv/config'
import { connectDB, disconnectDB } from './src/config/db.js'
import { hashPassword } from './src/utils/password.js'
import { encrypt } from './src/utils/encryption.js'
import { issueIfEligible } from './src/services/certificateService.js'
import User from './src/models/User.js'
import Course from './src/models/Course.js'
import Lesson from './src/models/Lesson.js'
import Enrollment from './src/models/Enrollment.js'
import Payment from './src/models/Payment.js'
import Certificate from './src/models/Certificate.js'

const PASSWORD = 'Passw0rd!2345'

async function clear() {
  await Promise.all([User, Course, Lesson, Enrollment, Payment, Certificate].map((m) => m.deleteMany({})))
}

async function run() {
  await connectDB()
  await clear()

  const passwordHash = await hashPassword(PASSWORD)
  const mkUser = (over) => User.create({ passwordHash, emailVerified: true, ...over })

  const admin = await mkUser({ email: 'admin@gyanpath.test', role: 'admin', profile: { name: 'Anita Sharma (Admin)' } })
  const moderator = await mkUser({ email: 'moderator@gyanpath.test', role: 'moderator', profile: { name: 'Bikash Thapa (Moderator)' } })

  const ramila = await mkUser({
    email: 'instructor@gyanpath.test',
    role: 'instructor',
    instructorVerified: true,
    profile: { name: 'Ramila Gurung' },
    payoutDetails: encrypt(JSON.stringify({ bankName: 'NIC Asia', accountNumber: '0123456789' })),
  })
  const suresh = await mkUser({
    email: 'instructor2@gyanpath.test',
    role: 'instructor',
    instructorVerified: true,
    profile: { name: 'Suresh Adhikari' },
  })

  const student = await mkUser({
    email: 'student@gyanpath.test',
    role: 'student',
    profile: { name: 'Manish Karki', interests: ['loksewa', 'coding'] },
  })

  // Demo account whose password is already 100 days old, so logging in immediately
  // triggers the 90-day forced-rotation flow (no waiting required to test it).
  await mkUser({
    email: 'expired@gyanpath.test',
    role: 'student',
    profile: { name: 'Puja Rai (expired password)' },
    passwordChangedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
  })

  // Real course content — each lesson embeds an actual educational video (verified,
  // embeddable) with its true length in minutes. { t: title, yt: youtubeId, min: minutes }
  const catalog = [
    {
      instructor: suresh,
      title: 'Full-Stack Web Development (MERN)',
      cover: 'fullstack-mern',
      category: 'Coding',
      priceNPR: 2500,
      description: 'Go from zero to deploying full-stack apps — HTML, CSS, JavaScript, React, Node/Express, and MongoDB, taught through complete hands-on courses.',
      lessons: [
        { t: 'HTML — Building the Structure', yt: 'kUMe1FH4CHE', min: 247 },
        { t: 'CSS — Styling the Web', yt: 'OXGznpKZ_sA', min: 668 },
        { t: 'JavaScript Fundamentals', yt: 'PkZNo7MFNFg', min: 207 },
        { t: 'Building UIs with React', yt: 'bMknfKXIFA8', min: 715 },
        { t: 'Back-End with Node & Express', yt: 'Oe421EPjeBE', min: 497 },
        { t: 'Databases with MongoDB', yt: 'c2M-rlkkT5o', min: 60 },
      ],
    },
    {
      instructor: suresh,
      title: 'Python for Data Analysis',
      cover: 'python-data',
      category: 'Coding',
      priceNPR: 1800,
      description: 'Learn Python from scratch, then use NumPy, Pandas, and SQL to turn messy data into insight.',
      lessons: [
        { t: 'Python for Beginners', yt: 'rfscVS0vtbw', min: 267 },
        { t: 'Data Analysis with NumPy & Pandas', yt: 'r-uOLxNrNk8', min: 262 },
        { t: 'Querying Data with SQL', yt: 'HXV3zeQKqGY', min: 261 },
      ],
    },
    {
      instructor: ramila,
      title: 'Ethical Hacking & Penetration Testing',
      cover: 'ethical-hacking',
      category: 'Cybersecurity',
      priceNPR: 3200,
      description: 'A hands-on journey through network penetration testing, recon, exploitation, and the Linux skills every ethical hacker needs.',
      lessons: [
        { t: 'Ethical Hacking — Full Course', yt: '3Kq1MIfTWCE', min: 891 },
        { t: 'Network Penetration Testing', yt: 'WnN6dbos5u8', min: 912 },
        { t: 'Computer Networking Essentials', yt: 'qiQR5rTSshw', min: 565 },
        { t: 'Linux for Hackers', yt: 'sWbUDq4S6Y8', min: 368 },
      ],
    },
    {
      instructor: ramila,
      title: 'Cyber Security Fundamentals',
      cover: 'cyber-fundamentals',
      category: 'Cybersecurity',
      priceNPR: 2200,
      description: 'Understand threats, defenses, networking, and secure systems from the ground up — the essentials for a career in security.',
      lessons: [
        { t: 'Cyber Security — Full Course', yt: 'hXSFdwIOfnE', min: 667 },
        { t: 'Networking for Security', yt: 'qiQR5rTSshw', min: 565 },
        { t: 'Linux Essentials', yt: 'sWbUDq4S6Y8', min: 368 },
      ],
    },
    {
      instructor: ramila,
      title: 'UI/UX Design with Figma',
      cover: 'uiux-figma',
      category: 'Design',
      priceNPR: 1600,
      description: 'Design real interfaces in Figma and turn them into responsive code with Tailwind CSS.',
      lessons: [
        { t: 'Figma for UI Design', yt: 'jwCmIBJ8Jtc', min: 617 },
        { t: 'Design to Code with Tailwind CSS', yt: 'lCxcTsOHrjo', min: 180 },
      ],
    },
    {
      instructor: suresh,
      title: 'Git, Linux & Developer Tools',
      cover: 'git-linux',
      category: 'Coding',
      priceNPR: 900,
      description: 'The everyday toolkit every developer needs — version control with Git & GitHub, the Linux command line, and C fundamentals.',
      lessons: [
        { t: 'Git & GitHub for Beginners', yt: 'RGOj5yH7evk', min: 69 },
        { t: 'The Linux Command Line', yt: 'sWbUDq4S6Y8', min: 368 },
        { t: 'C Programming Basics', yt: 'KJgsSFOSQv0', min: 226 },
      ],
    },
  ]

  const created = []
  for (const c of catalog) {
    const course = await Course.create({
      instructorId: c.instructor._id,
      title: c.title,
      description: c.description,
      category: c.category,
      priceNPR: c.priceNPR,
      status: 'approved',
      // original GyanPath cover art (client/public/covers), generated by
      // scripts/generate-covers.js — not a scraped YouTube video still
      thumbnailUrl: `/covers/${c.cover}.svg`,
    })
    const lessons = await Lesson.insertMany(
      c.lessons.map((l, i) => ({
        courseId: course._id,
        title: l.t,
        order: i + 1,
        isPreview: i === 0,
        youtubeId: l.yt,
        durationSec: l.min * 60,
        // give the first (free-preview) lesson of each course a transcript so the
        // accessibility transcript panel is demonstrable
        transcript: i === 0
          ? `Transcript — ${l.t}\n\nWelcome to this lesson. In this session we walk through ${l.t.toLowerCase()} step by step, with practical examples you can follow along.\n\n[00:00] Introduction and what you'll learn.\n[02:30] Core concepts explained with real examples.\n[10:00] Hands-on walkthrough.\n[${String(Math.min(59, Math.floor(l.min / 4))).padStart(2, '0')}:00] Recap and next steps.\n\nThis transcript is provided for accessibility and low-bandwidth learners who prefer to read along or cannot stream video.`
          : undefined,
      })),
    )
    created.push({ course, lessons })
  }

  // a course still waiting in the moderation queue, so that screen isn't empty
  await Course.create({
    instructorId: suresh._id,
    title: 'Advanced Excel for Office Work',
    description: 'Pivot tables, formulas, and dashboards. Pending review.',
    category: 'Office',
    priceNPR: 1100,
    status: 'pending',
  })

  // enroll the demo student in the first course with some real progress (in progress)
  const first = created[0]
  await Enrollment.create({
    userId: student._id,
    courseId: first.course._id,
    progress: [
      { lessonId: first.lessons[0]._id, watchedSeconds: first.lessons[0].durationSec, completed: true },
      { lessonId: first.lessons[1]._id, watchedSeconds: Math.round(first.lessons[1].durationSec / 2), completed: false },
    ],
  })

  // a second course fully completed, so the student has a real (signed) certificate to show
  const done = created[created.length - 1] // Spoken English — short, 3 lessons
  const doneEnrollment = await Enrollment.create({
    userId: student._id,
    courseId: done.course._id,
    progress: done.lessons.map((l) => ({ lessonId: l._id, watchedSeconds: l.durationSec, completed: true })),
  })
  await Payment.create({
    userId: student._id,
    courseId: done.course._id,
    provider: 'esewa',
    transactionUuid: `seed_${student._id}_${done.course._id}`,
    amountNPR: done.course.priceNPR,
    status: 'succeeded',
  })
  const certificate = await issueIfEligible(doneEnrollment, student, done.course)

  console.log('\nSeed complete. Log in with password:', PASSWORD)
  console.table([
    { role: 'Admin', email: admin.email },
    { role: 'Moderator', email: moderator.email },
    { role: 'Instructor', email: ramila.email },
    { role: 'Instructor', email: suresh.email },
    { role: 'Student', email: student.email },
  ])
  console.log(`${created.length} approved courses + 1 pending. Student: 1 in-progress + 1 completed course.`)
  if (certificate) console.log(`Certificate issued: ${certificate.certificateId} (${done.course.title})\n`)

  await disconnectDB()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
