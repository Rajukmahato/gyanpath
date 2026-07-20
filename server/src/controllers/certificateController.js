import fs from 'node:fs'
import path from 'node:path'
import Certificate from '../models/Certificate.js'
import { certificatePayload, verifySignature } from '../services/certificateService.js'

export async function listMine(req, res) {
  const certificates = await Certificate.find({ userId: req.user._id }).populate('courseId', 'title').lean()
  res.json(certificates)
}

export async function verify(req, res) {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId })
    .populate('userId', 'email profile.name')
    .populate('courseId', 'title')

  if (!cert) return res.status(404).json({ valid: false })

  const payload = certificatePayload(cert.certificateId, cert.userId._id, cert.courseId._id, cert.issuedAt)
  const valid = verifySignature(payload, cert.signature)

  res.json({
    valid,
    certificateId: cert.certificateId,
    studentName: cert.userId?.profile?.name || cert.userId?.email,
    courseTitle: cert.courseId?.title,
    issuedAt: cert.issuedAt,
  })
}

export async function download(req, res) {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId, userId: req.user._id })
  if (!cert) return res.status(404).json({ error: 'not found' })

  const filePath = path.resolve('uploads', cert.pdfObjectKey)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'certificate file not available' })

  res.download(filePath, `${cert.certificateId}.pdf`)
}
