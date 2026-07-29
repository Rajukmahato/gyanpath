import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'

export default function MfaChallenge() {
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const { verifyMfaLogin } = useAuth()
  const navigate = useNavigate()
  const mfaToken = useLocation().state?.mfaToken

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      const data = await verifyMfaLogin(mfaToken, token)
      if (data.passwordExpired) navigate('/change-expired-password', { state: { passwordChangeToken: data.passwordChangeToken } })
      else navigate('/')
    } catch (err) {
      setError(err.body?.error || err.message)
    }
  }

  if (!mfaToken) {
    return (
      <AuthLayout title="Two-factor authentication">
        <Alert tone="info">Start by logging in first.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Enter your authenticator code" subtitle="Open your authenticator app for the current 6-digit code.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand-600" /> Authentication code</Label>
          <Input placeholder="123456" required value={token} onChange={(e) => setToken(e.target.value)} className="tracking-widest" />
        </div>
        <Button className="w-full" size="lg" type="submit">Verify</Button>
      </form>
    </AuthLayout>
  )
}
