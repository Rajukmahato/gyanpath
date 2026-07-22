import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import PDFDocument from 'pdfkit'
import User from '../models/User.js'

const AVATAR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/avatars')
fs.mkdirSync(AVATAR_DIR, { recursive: true })

const avatarStorage = multer.diskStorage({
  destination: AVATAR_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${req.user._id}${ext}`)
  },
})

const avatarUploadMiddleware = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'))
    cb(null, true)
  },
}).single('avatar')

export function uploadAvatar(req, res) {
  avatarUploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
    const url = `/api/users/avatars/${req.file.filename}`
    req.user.avatarUrl = url
    await req.user.save()
    res.json({ avatarUrl: url })
  })
}

export function serveAvatar(req, res) {
  const filename = path.basename(req.params.filename) // prevent path traversal
  const filePath = path.join(AVATAR_DIR, filename)
  if (!fs.existsSync(filePath)) return res.status(404).end()
  // allow the client on a different port to embed this image
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.sendFile(filePath)
}
import Enrollment from '../models/Enrollment.js'
import Certificate from '../models/Certificate.js'
import { decrypt } from '../utils/encryption.js'
import { logAction } from '../services/auditService.js'

const PATCHABLE_PROFILE_FIELDS = ['name', 'bio', 'interests', 'language']

export async function getProfile(req, res) {
  const { _id, email, role, profile, mfaEnabled, instructorVerified, avatarUrl } = req.user
  res.json({ id: _id, email, role, profile, mfaEnabled, instructorVerified, avatarUrl })
}

export async function updateProfile(req, res) {
  const body = req.body

  if (body.profile && typeof body.profile === 'object') {
    for (const field of PATCHABLE_PROFILE_FIELDS) {
      if (field in body.profile) req.user.profile[field] = body.profile[field]
    }
  }

  // instructors may update their payout details; everything else in the body is ignored,
  // so a client can never sneak `role` or `instructorVerified` through this endpoint
  if (req.user.role === 'instructor' && body.payoutDetails) {
    const { encrypt } = await import('../utils/encryption.js')
    req.user.payoutDetails = encrypt(JSON.stringify(body.payoutDetails))
  }

  await req.user.save()
  res.json({ message: 'profile updated' })
}

export async function exportData(req, res) {
  const enrollments = await Enrollment.find({ userId: req.user._id }).populate('courseId', 'title').lean()
  const certificates = await Certificate.find({ userId: req.user._id }).lean()

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="gyanpath-data-${req.user._id}.pdf"`)
  doc.pipe(res)

  doc.fontSize(22).font('Helvetica-Bold').text('GyanPath — My Account Data', { align: 'center' })
  doc.moveDown(0.4)
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(`Generated ${new Date().toUTCString()}`, { align: 'center' })
  doc.moveDown(1).fillColor('#000')

  doc.fontSize(14).font('Helvetica-Bold').text('Profile')
  doc.moveDown(0.3)
  doc.fontSize(11).font('Helvetica')
  doc.text(`Name:    ${req.user.profile?.name || '—'}`)
  doc.text(`Email:   ${req.user.email}`)
  doc.text(`Role:    ${req.user.role}`)
  doc.text(`Joined:  ${req.user.createdAt.toDateString()}`)
  doc.moveDown(1)

  doc.fontSize(14).font('Helvetica-Bold').text('Enrolled Courses')
  doc.moveDown(0.3)
  if (!enrollments.length) {
    doc.fontSize(11).font('Helvetica').fillColor('#666').text('No enrollments yet.')
  } else {
    for (const e of enrollments) {
      const completed = (e.progress || []).filter((p) => p.completed).length
      const total = (e.progress || []).length
      doc.fontSize(11).font('Helvetica').fillColor('#000')
        .text(`• ${e.courseId?.title || '(deleted course)'}  [${e.status}]  ${completed}/${total} lessons completed`)
    }
  }
  doc.moveDown(1).fillColor('#000')

  doc.fontSize(14).font('Helvetica-Bold').text('Certificates')
  doc.moveDown(0.3)
  if (!certificates.length) {
    doc.fontSize(11).font('Helvetica').fillColor('#666').text('No certificates yet.')
  } else {
    for (const c of certificates) {
      doc.fontSize(11).font('Helvetica').fillColor('#000')
        .text(`• ID: ${c.certificateId}   Issued: ${new Date(c.issuedAt).toDateString()}`)
    }
  }
  doc.end()
}

// Machine-readable export (data portability). The PDF export above is for humans; this
// JSON is what the import endpoint below can consume, satisfying the privacy-law
// "right to data portability" in a round-trippable form.
export async function exportDataJson(req, res) {
  const [enrollments, certificates] = await Promise.all([
    Enrollment.find({ userId: req.user._id }).populate('courseId', 'title').lean(),
    Certificate.find({ userId: req.user._id }).lean(),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 'gyanpath.user-export.v1',
    profile: {
      name: req.user.profile?.name || '',
      bio: req.user.profile?.bio || '',
      interests: req.user.profile?.interests || [],
      language: req.user.profile?.language || 'en',
    },
    account: { email: req.user.email, role: req.user.role, joined: req.user.createdAt },
    enrollments: enrollments.map((e) => ({
      course: e.courseId?.title || null,
      status: e.status,
      lessonsCompleted: (e.progress || []).filter((p) => p.completed).length,
    })),
    certificates: certificates.map((c) => ({ certificateId: c.certificateId, issuedAt: c.issuedAt })),
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="gyanpath-data-${req.user._id}.json"`)
  res.send(JSON.stringify(payload, null, 2))
}

// Re-import a previously exported profile. Only the user's own editable preferences are
// restored — account fields (email/role), enrollments and certificates are ignored, so a
// tampered export file can never escalate privileges or forge ownership (mass-assignment safe).
export async function importData(req, res) {
  let incoming = req.body?.profile
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'a "profile" object is required' })
  }

  // Older exports nested the editable fields one level deeper (profile.profile) alongside
  // account metadata; unwrap that shape so files downloaded before the v1 schema still import.
  if (
    incoming.profile && typeof incoming.profile === 'object' &&
    !PATCHABLE_PROFILE_FIELDS.some((field) => field in incoming)
  ) {
    incoming = incoming.profile
  }

  const applied = []
  for (const field of PATCHABLE_PROFILE_FIELDS) {
    if (field in incoming) {
      req.user.profile[field] = incoming[field]
      applied.push(field)
    }
  }

  if (!applied.length) return res.status(400).json({ error: 'no importable profile fields found' })

  await req.user.save()
  await logAction({ actor: req.user._id, role: req.user.role, action: 'data_import', resourceType: 'User', resourceId: req.user._id, ip: req.ip, status: 'success', metadata: { fields: applied } })
  res.json({ message: 'profile data imported', imported: applied })
}

export async function deleteAccount(req, res) {
  const userId = req.user._id
  await Enrollment.deleteMany({ userId })
  await Certificate.deleteMany({ userId })
  await User.deleteOne({ _id: userId })
  await logAction({ actor: userId, role: req.user.role, action: 'account_deleted', resourceType: 'User', resourceId: userId, ip: req.ip, status: 'success' })
  res.clearCookie('refreshToken', { path: '/api/auth' })
  res.clearCookie('hasSession', { path: '/' })
  res.json({ message: 'account deleted' })
}

export async function getPayoutDetails(req, res) {
  if (!req.user.payoutDetails) return res.json({ payoutDetails: null })
  res.json({ payoutDetails: JSON.parse(decrypt(req.user.payoutDetails)) })
}

export async function listUnverifiedInstructors(req, res) {
  const instructors = await User.find({ role: 'instructor', instructorVerified: false })
    .select('email profile createdAt')
    .lean()
  res.json(instructors)
}

export async function verifyInstructor(req, res) {
  const instructor = await User.findOne({ _id: req.params.id, role: 'instructor' })
  if (!instructor) return res.status(404).json({ error: 'not found' })

  instructor.instructorVerified = true
  await instructor.save()

  await logAction({
    actor: req.user._id,
    role: req.user.role,
    action: 'instructor_verified',
    resourceType: 'User',
    resourceId: instructor._id,
    ip: req.ip,
    status: 'success',
  })

  res.json({ message: 'instructor verified' })
}
