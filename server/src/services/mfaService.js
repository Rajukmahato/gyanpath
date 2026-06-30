import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export function generateMfaSecret(email) {
  const secret = speakeasy.generateSecret({ name: `GyanPath (${email})` })
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url }
}

export function getQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyMfaToken(base32Secret, token) {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token,
    window: 1,
  })
}
