export const REFRESH_COOKIE_NAME = 'refreshToken'
// readable (non-httpOnly) marker so the client can tell whether a session
// might exist without making a network call — avoids a pointless 401 on
// every anonymous page load just to find out there's no cookie to refresh
export const HAS_SESSION_COOKIE_NAME = 'hasSession'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE_MS,
    path: '/api/auth',
  })
  res.cookie(HAS_SESSION_COOKIE_NAME, '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })
  res.clearCookie(HAS_SESSION_COOKIE_NAME, { path: '/' })
}
