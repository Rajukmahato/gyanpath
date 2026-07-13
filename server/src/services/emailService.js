import nodemailer from 'nodemailer'

// Gmail SMTP via an App Password. Configure GMAIL_USER + GMAIL_APP_PASSWORD in .env
// (see the guide in the README/.env.example). When unset, email is skipped and callers
// fall back to logging the code to the server console — so dev works with no setup.
let transporter

export function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) return false
  const from = `GyanPath <${process.env.GMAIL_USER}>`
  await getTransporter().sendMail({ from, to, subject, html, text })
  return true
}

const PURPOSE_COPY = {
  register: {
    subject: 'Verify your GyanPath account',
    line: 'Use this code to verify your email and activate your account:',
  },
  pwreset: {
    subject: 'Reset your GyanPath password',
    line: 'Use this code to reset your password:',
  },
}

export async function sendOtpEmail(to, code, purpose = 'register') {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.register
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#8a1128;font-weight:700">GyanPath</h2>
      <p>${copy.line}</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#111">${code}</p>
      <p style="color:#666;font-size:13px">This code expires in 5 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`
  return sendEmail({ to, subject: copy.subject, html, text: `${copy.line} ${code}` })
}
