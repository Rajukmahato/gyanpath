import zxcvbn from 'zxcvbn'

const MIN_LENGTH = 12
const MIN_ZXCVBN_SCORE = 3

export function checkPasswordStrength(password) {
  const result = zxcvbn(password)
  const reasons = []

  if (password.length < MIN_LENGTH) reasons.push(`must be at least ${MIN_LENGTH} characters`)
  if (!/[a-z]/.test(password)) reasons.push('must include a lowercase letter')
  if (!/[A-Z]/.test(password)) reasons.push('must include an uppercase letter')
  if (!/[0-9]/.test(password)) reasons.push('must include a digit')
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push('must include a special character')
  if (result.score < MIN_ZXCVBN_SCORE) reasons.push('too easy to guess')

  return { ok: reasons.length === 0, score: result.score, reasons }
}
