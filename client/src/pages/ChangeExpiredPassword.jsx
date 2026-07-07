import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { api } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import { Label, PasswordInput } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

export default function ChangeExpiredPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const passwordChangeToken = useLocation().state?.passwordChangeToken

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      await api.changeExpiredPassword({ passwordChangeToken, newPassword })
      setDone(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.body?.reasons?.join(', ') || err.body?.error || err.message)
    }
  }

  if (!passwordChangeToken) {
    return (
      <AuthLayout title="Password expired">
        <Alert tone="info">Please log in first to change your expired password.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Your password has expired"
      subtitle="For your security, passwords must be changed every 90 days. Set a new one to continue."
    >
      {done ? (
        <Alert tone="success">Password updated. Redirecting you to log in…</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <Label className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-brand-600" /> New password</Label>
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
            Set new password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
