import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { MailCheck } from 'lucide-react'
import { api } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    await api.requestPasswordReset({ email })
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="text-center">
          <MailCheck className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 text-sm text-ink-600">If that email is registered, a reset code has been sent.</p>
          <Button className="mt-5 w-full" onClick={() => navigate('/reset-password', { state: { email } })}>
            I have a code
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Forgot password" subtitle="We'll send a reset code to your email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button className="w-full" size="lg" type="submit">Send reset code</Button>
        <p className="text-center text-sm text-ink-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">Back to login</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
