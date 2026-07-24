import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Fingerprint } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { api, API_URL } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label, PasswordInput } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'

const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'

const OAUTH_ERRORS = {
  invalid_state: 'Google sign-in could not be verified. Please try again.',
  email_unverified: 'Your Google email is not verified, so we can’t sign you in with it.',
  not_configured: 'Google sign-in is not available right now.',
  session: 'We couldn’t complete your Google sign-in. Please try again.',
  oauth_failed: 'Something went wrong with Google sign-in. Please try again.',
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(() => {
    const code = searchParams.get('oauth_error')
    return code ? OAUTH_ERRORS[code] || OAUTH_ERRORS.oauth_failed : null
  })
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  // only offer "Continue with Google" if the server actually has OAuth credentials
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const captchaRef = useRef(null)
  const { login, loginWithPasskey } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.oauthProviders()
      .then(({ google }) => setGoogleEnabled(Boolean(google)))
      .catch(() => setGoogleEnabled(false))
  }, [])

  async function handlePasskey() {
    setError(null)
    setPasskeyLoading(true)
    try {
      await loginWithPasskey()
      navigate('/')
    } catch (err) {
      // user cancelling the browser prompt throws NotAllowedError — don't alarm them
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') return
      setError(err.body?.error || err.message || 'Passkey sign-in failed.')
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (captchaRequired && !captchaToken) {
      setError('Please complete the CAPTCHA verification below.')
      return
    }

    setLoading(true)
    try {
      const data = await login(email, password, captchaToken)
      if (data.captchaRequired) {
        setCaptchaRequired(true)
        setCaptchaToken(null)
        captchaRef.current?.resetCaptcha()
        setError('Too many failed attempts — please complete the CAPTCHA to continue.')
        return
      }
      if (data.passwordExpired) navigate('/change-expired-password', { state: { passwordChangeToken: data.passwordChangeToken } })
      else if (data.mfaRequired) navigate('/mfa-challenge', { state: { mfaToken: data.mfaToken } })
      else navigate('/')
    } catch (err) {
      const body = err.body || {}
      if (body.captchaRequired) {
        setCaptchaRequired(true)
        setCaptchaToken(null)
        captchaRef.current?.resetCaptcha()
      }
      setError(body.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue your learning.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="mb-0">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {captchaRequired && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 text-center">
              Multiple failed attempts detected. Please verify you're human.
            </p>
            <HCaptcha
              ref={captchaRef}
              sitekey={SITE_KEY}
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          </div>
        )}

        <Button className="w-full" size="lg" type="submit" disabled={loading || (captchaRequired && !captchaToken)}>
          {loading ? 'Logging in…' : 'Log in'}
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-200" />
          <span className="text-xs text-ink-400">or</span>
          <span className="h-px flex-1 bg-ink-200" />
        </div>

        {googleEnabled && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => { window.location.href = `${API_URL}/api/auth/oauth/google` }}
          >
            <GoogleIcon /> Continue with Google
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handlePasskey}
          disabled={passkeyLoading}
        >
          <Fingerprint className="h-4 w-4" /> {passkeyLoading ? 'Waiting for passkey…' : 'Sign in with a passkey'}
        </Button>

        <p className="text-center text-sm text-ink-500">
          New to GyanPath? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
