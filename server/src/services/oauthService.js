// Hand-rolled Google OAuth 2.0 (Authorization Code flow). No third-party auth SDK
// (Firebase/Auth0/Supabase are disallowed) — we talk to Google's endpoints directly.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/oauth/google/callback'
}

// The URL we send the browser to for Google's consent screen. `state` is an
// unguessable value we also stash in a cookie, to defend the callback against CSRF.
export function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// Swap the one-time authorization code for an access token, then read the user's
// verified email/name from the userinfo endpoint.
export async function exchangeCodeForProfile(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  })

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenRes.ok) throw new Error('google token exchange failed')
  const { access_token: accessToken } = await tokenRes.json()
  if (!accessToken) throw new Error('google token exchange returned no access token')

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) throw new Error('google userinfo fetch failed')
  const profile = await profileRes.json()

  return {
    sub: profile.sub,
    email: profile.email,
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
    name: profile.name,
  }
}
