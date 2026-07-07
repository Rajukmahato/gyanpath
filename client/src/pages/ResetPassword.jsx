import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label, PasswordInput } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

export default function ResetPassword() {
  const [email, setEmail] = useState(useLocation().state?.email || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      await api.confirmPasswordReset({ email, code, newPassword })
      navigate('/login')
    } catch (err) {
      setError(err.body?.reasons?.join(', ') || err.body?.error || err.message)
    }
  }

  return (
    <AuthLayout title="Reset password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Reset code</Label>
          <Input required value={code} onChange={(e) => setCode(e.target.value)} className="tracking-widest" />
        </div>
        <div>
          <Label>New password</Label>
          <PasswordInput required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordStrengthMeter password={newPassword} />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <PasswordInput
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={mismatch ? 'border-red-400' : ''}
          />
          {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={mismatch}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
