import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { api } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'

export default function VerifyOtp() {
  const [email, setEmail] = useState(useLocation().state?.email || '')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.verifyOtp({ email, code })
      navigate('/login')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleResend() {
    setError(null)
    setInfo(null)
    try {
      await api.resendOtp({ email })
      setInfo('A new code has been sent. Check your email (or the server log in dev).')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code we sent to your email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Verification code</Label>
          <Input placeholder="123456" required value={code} onChange={(e) => setCode(e.target.value)} className="tracking-widest" />
        </div>
        <Button className="w-full" size="lg" type="submit">Verify</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={handleResend} className="font-medium text-brand-600 hover:underline">
            Resend code
          </button>
          <Link to="/login" className="text-ink-500 hover:underline">Back to login</Link>
        </div>
      </form>
    </AuthLayout>
  )
}
