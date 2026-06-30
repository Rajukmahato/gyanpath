import argon2 from 'argon2'

export function hashPassword(plainText) {
  return argon2.hash(plainText, { type: argon2.argon2id })
}

export function verifyPassword(hash, plainText) {
  return argon2.verify(hash, plainText)
}

const RECENT_PASSWORD_LIMIT = 5

export async function wasRecentlyUsed(recentPasswordHashes, plainText) {
  for (const hash of recentPasswordHashes) {
    if (await argon2.verify(hash, plainText)) return true
  }
  return false
}

export function pushRecentPasswordHash(recentPasswordHashes, hash) {
  return [hash, ...recentPasswordHashes].slice(0, RECENT_PASSWORD_LIMIT)
}
