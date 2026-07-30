// Repoints existing courses at the generated cover art (client/public/covers).
//
// seed.js already sets the new thumbnailUrl, but re-seeding wipes enrolments, payments
// and certificates — not something to do to a database you're demoing from. This updates
// the covers in place and leaves everything else alone.
//
//   node scripts/apply-covers.js
//
// Idempotent: re-running changes nothing once the covers are applied.
import 'dotenv/config'
import mongoose from 'mongoose'
import Course from '../src/models/Course.js'

// Courses are matched by title so this works against any database, seeded or hand-made.
const BY_TITLE = {
  'Full-Stack Web Development (MERN)': 'fullstack-mern',
  'Python for Data Analysis': 'python-data',
  'Ethical Hacking & Penetration Testing': 'ethical-hacking',
  'Cyber Security Fundamentals': 'cyber-fundamentals',
  'UI/UX Design with Figma': 'uiux-figma',
  'Git, Linux & Developer Tools': 'git-linux',
  'Advanced Excel for Office Work': 'advanced-excel',
}

// Anything not named above still gets art appropriate to its category rather than
// keeping a YouTube still.
const BY_CATEGORY = {
  Coding: 'fullstack-mern',
  Cybersecurity: 'cyber-fundamentals',
  Design: 'uiux-figma',
  Office: 'advanced-excel',
}

const uri = process.env.MONGO_URI
if (!uri) {
  console.error('MONGO_URI is not set — check server/.env')
  process.exit(1)
}

await mongoose.connect(uri)

const courses = await Course.find({}, 'title category thumbnailUrl')
let changed = 0
let skipped = 0

for (const course of courses) {
  const slug = BY_TITLE[course.title] || BY_CATEGORY[course.category]
  if (!slug) {
    console.warn(`  ?  no cover for "${course.title}" (${course.category}) — left as is`)
    skipped++
    continue
  }
  const thumbnailUrl = `/covers/${slug}.svg`
  if (course.thumbnailUrl === thumbnailUrl) {
    skipped++
    continue
  }
  await Course.updateOne({ _id: course._id }, { $set: { thumbnailUrl } })
  console.log(`  ✓  ${course.title}\n       ${course.thumbnailUrl || '(none)'} -> ${thumbnailUrl}`)
  changed++
}

console.log(`\n${changed} updated, ${skipped} already current or unmatched.`)
await mongoose.connection.close()
