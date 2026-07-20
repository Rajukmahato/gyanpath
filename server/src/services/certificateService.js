import crypto, { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import Certificate from '../models/Certificate.js'
import Lesson from '../models/Lesson.js'
import User from '../models/User.js'
import { clientOrigin } from '../utils/clientOrigin.js'

const CERT_DIR = path.resolve('uploads/certificates')

const COLORS = {
  brand: '#8A1128',
  brandDark: '#6E0E20',
  gold: '#C4A052',
  goldDark: '#9A7B2E',
  ink: '#2A2A2A',
  gray: '#78716B',
  cream: '#FCFAF5',
  white: '#FFFFFF',
}

function sign(payload) {
  return crypto.createHmac('sha256', process.env.CERT_SIGNING_SECRET).update(payload).digest('hex')
}

export function certificatePayload(certificateId, userId, courseId, issuedAt) {
  return `${certificateId}|${userId}|${courseId}|${issuedAt.toISOString()}`
}

export function verifySignature(payload, signature) {
  const expected = sign(payload)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature || '')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Returns the newly created certificate, or null if one already existed or the
// course isn't fully completed yet — callers use the return value to know whether
// a certificate was *just* issued, not merely whether one exists.
export async function issueIfEligible(enrollment, user, course) {
  const existing = await Certificate.findOne({ userId: user._id, courseId: course._id })
  if (existing) return null

  const totalLessons = await Lesson.countDocuments({ courseId: course._id })
  const completedLessons = enrollment.progress.filter((p) => p.completed).length
  if (totalLessons === 0 || completedLessons < totalLessons) return null

  const certificateId = randomUUID()
  const issuedAt = new Date()
  const signature = sign(certificatePayload(certificateId, user._id, course._id, issuedAt))

  const instructor = await User.findById(course.instructorId).select('profile.name email').lean()
  const origin = clientOrigin()

  fs.mkdirSync(CERT_DIR, { recursive: true })
  const pdfObjectKey = `certificates/${certificateId}.pdf`
  await renderCertificatePdf(path.resolve('uploads', pdfObjectKey), {
    studentName: user.profile?.name || user.email,
    courseTitle: course.title,
    instructorName: instructor?.profile?.name || 'GyanPath Faculty',
    certificateId,
    issuedAt,
    verifyUrl: `${origin}/verify-certificate?id=${certificateId}`,
  })

  return Certificate.create({ userId: user._id, courseId: course._id, certificateId, issuedAt, signature, pdfObjectKey })
}

function starPoints(cx, cy, outer, inner) {
  const pts = []
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const ang = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)])
  }
  return pts
}

function drawSeal(doc, cx, cy, r) {
  // ribbon tails behind the medallion
  doc.polygon([cx - 13, cy + r - 4], [cx - 4, cy + r + 34], [cx - 15, cy + r + 30], [cx - 24, cy + r - 2]).fill(COLORS.brandDark)
  doc.polygon([cx + 13, cy + r - 4], [cx + 4, cy + r + 34], [cx + 15, cy + r + 30], [cx + 24, cy + r - 2]).fill(COLORS.brandDark)
  // gold outer disc + brand inner disc
  doc.circle(cx, cy, r).fill(COLORS.gold)
  doc.circle(cx, cy, r).lineWidth(1.5).stroke(COLORS.goldDark)
  doc.circle(cx, cy, r - 6).fill(COLORS.brand)
  doc.circle(cx, cy, r - 6).lineWidth(0.8).stroke(COLORS.gold)
  doc.polygon(...starPoints(cx, cy - 3, 11, 4.5)).fill(COLORS.gold)
  doc.font('Helvetica-Bold').fontSize(5.5).fillColor(COLORS.gold)
    .text('CERTIFIED', cx - 24, cy + 9, { width: 48, align: 'center', characterSpacing: 1 })
}

function drawCorner(doc, x, y, dx, dy) {
  const len = 26
  doc.lineWidth(1).strokeColor(COLORS.gold)
  doc.moveTo(x, y).lineTo(x + dx * len, y).stroke()
  doc.moveTo(x, y).lineTo(x, y + dy * len).stroke()
  doc.polygon([x + dx * 6, y + dy * 2], [x + dx * 10, y + dy * 6], [x + dx * 6, y + dy * 10], [x + dx * 2, y + dy * 6]).fill(COLORS.gold)
}

export async function renderCertificatePdf(filePath, opts) {
  const { studentName, courseTitle, instructorName, certificateId, issuedAt, verifyUrl } = opts
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    width: 200,
    margin: 1,
    color: { dark: COLORS.ink, light: COLORS.white },
  })

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const W = doc.page.width
    const H = doc.page.height
    const cx = W / 2

    // background + decorative double frame
    doc.rect(0, 0, W, H).fill(COLORS.cream)
    const mo = 24
    doc.lineWidth(3).rect(mo, mo, W - mo * 2, H - mo * 2).stroke(COLORS.brand)
    const gi = mo + 8
    doc.lineWidth(1).rect(gi, gi, W - gi * 2, H - gi * 2).stroke(COLORS.gold)
    drawCorner(doc, gi + 6, gi + 6, 1, 1)
    drawCorner(doc, W - gi - 6, gi + 6, -1, 1)
    drawCorner(doc, gi + 6, H - gi - 6, 1, -1)
    drawCorner(doc, W - gi - 6, H - gi - 6, -1, -1)

    // faint star watermark behind the body
    doc.save().fillOpacity(0.04)
    doc.polygon(...starPoints(cx, 250, 150, 62)).fill(COLORS.gold)
    doc.restore()

    // brand wordmark
    doc.font('Times-Bold').fontSize(22).fillColor(COLORS.brand)
      .text('GyanPath', 0, 60, { width: W, align: 'center' })
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray)
      .text('PATH OF KNOWLEDGE', 0, 88, { width: W, align: 'center', characterSpacing: 3 })

    // title
    doc.font('Times-Bold').fontSize(31).fillColor(COLORS.ink)
      .text('CERTIFICATE OF COMPLETION', 0, 118, { width: W, align: 'center', characterSpacing: 3 })

    // flourish divider (line + centered diamond)
    const dY = 165
    doc.lineWidth(1).strokeColor(COLORS.gold)
    doc.moveTo(cx - 150, dY).lineTo(cx - 12, dY).stroke()
    doc.moveTo(cx + 12, dY).lineTo(cx + 150, dY).stroke()
    doc.polygon([cx, dY - 5], [cx + 6, dY], [cx, dY + 5], [cx - 6, dY]).fill(COLORS.gold)

    // body
    doc.font('Times-Italic').fontSize(13).fillColor(COLORS.gray)
      .text('This is to certify that', 0, 194, { width: W, align: 'center' })

    doc.font('Times-Bold').fontSize(40).fillColor(COLORS.ink)
      .text(studentName, 0, 218, { width: W, align: 'center' })
    const nameW = Math.min(doc.widthOfString(studentName) + 90, W - 220)
    doc.lineWidth(1).strokeColor(COLORS.gold)
      .moveTo(cx - nameW / 2, 274).lineTo(cx + nameW / 2, 274).stroke()

    doc.font('Helvetica').fontSize(12).fillColor(COLORS.gray)
      .text('has successfully completed the course', 0, 288, { width: W, align: 'center' })
    doc.font('Times-BoldItalic').fontSize(22).fillColor(COLORS.brand)
      .text(courseTitle, 60, 312, { width: W - 120, align: 'center' })

    doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.gray)
      .text(`Completed on ${issuedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        0, 352, { width: W, align: 'center' })

    // seal
    drawSeal(doc, cx, 448, 30)

    // signature blocks
    const sigY = 496
    const drawSig = (x, w, role, name) => {
      doc.lineWidth(0.8).strokeColor(COLORS.ink).moveTo(x, sigY).lineTo(x + w, sigY).stroke()
      doc.font('Times-Bold').fontSize(11).fillColor(COLORS.ink)
        .text(name, x, sigY + 5, { width: w, align: 'center' })
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray)
        .text(role, x, sigY + 20, { width: w, align: 'center', characterSpacing: 1 })
    }
    drawSig(120, 175, 'COURSE INSTRUCTOR', instructorName)
    drawSig(W - 120 - 175, 175, 'GYANPATH ACADEMY', 'Authorized Signatory')

    // QR verification block (bottom-right, inside the frame)
    const qs = 58
    const qx = W - gi - 14 - qs
    const qy = 430
    doc.rect(qx - 4, qy - 4, qs + 8, qs + 8).fill(COLORS.white)
    doc.image(qrPng, qx, qy, { width: qs, height: qs })
    doc.font('Helvetica').fontSize(6).fillColor(COLORS.gray)
      .text('SCAN TO VERIFY', qx - 6, qy + qs + 4, { width: qs + 12, align: 'center', characterSpacing: 0.5 })

    // footer: certificate id + verify note
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray)
      .text(`Certificate No. ${certificateId}`, 0, H - 44, { width: W, align: 'center' })
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.gray)
      .text('Authenticity verifiable at gyanpath.verify-certificate', 0, H - 33, { width: W, align: 'center' })

    doc.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}
