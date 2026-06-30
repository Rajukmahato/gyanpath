import argon2 from 'argon2'

export function hashPassword(plainText) {
  return argon2.hash(plainText, { type: argon2.argon2id })
}

export function verifyPassword(hash, plainText) {
  return argon2.verify(hash, plainText)
}
