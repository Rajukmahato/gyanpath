import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Fingerprint } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label, PasswordInput } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'

const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const captchaRef = useRef(null)
  const { login, loginWithPasskey } = useAuth()
  const navigate = useNavigate()

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
