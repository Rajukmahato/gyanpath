export const REFRESH_COOKIE_NAME = 'refreshToken'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE_MS,
    path: '/api/auth',
  })
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })
}
