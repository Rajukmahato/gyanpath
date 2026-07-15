import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AuthLayout from '../components/AuthLayout.jsx'

// Landing page for the Google OAuth redirect. The server sent the access token in the URL
// fragment (never logged, never sent to servers) and set the refresh cookie; we adopt the
// token, wipe it from the address bar/history, then continue into the app.
export default function OAuthCallback() {
  const { completeOAuthLogin } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // guard against React 18 StrictMode double-invoke
    ran.current = true

    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const mfaToken = params.get('mfa_token')
    // scrub the token from the URL so it can't linger in history or a shared link
    window.history.replaceState(null, '', window.location.pathname)

    // the account has 2FA on: Google proved the identity, the authenticator code is still owed
    if (mfaToken) {
      navigate('/mfa-challenge', { replace: true, state: { mfaToken } })
      return
    }

    if (!accessToken) {
      navigate('/login?oauth_error=session', { replace: true })
      return
    }

    completeOAuthLogin(accessToken)
      .then(() => navigate('/', { replace: true }))
      .catch(() => navigate('/login?oauth_error=session', { replace: true }))
  }, [completeOAuthLogin, navigate])

  return (
    <AuthLayout title="Signing you in…" subtitle="Finishing your Google sign-in, one moment.">
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    </AuthLayout>
  )
}
