import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, Presentation } from 'lucide-react'
import { api } from '../api/client.js'
import AuthLayout from '../components/AuthLayout.jsx'
import Input, { Label, PasswordInput } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

const ROLES = [
  { value: 'student', label: 'Learn', desc: 'Buy and take courses', icon: GraduationCap },
  { value: 'instructor', label: 'Teach', desc: 'Create and sell courses', icon: Presentation },
]

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.register({ email, password, name, role })
      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      setError(err.body?.reasons?.join(', ') || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start learning or start teaching on GyanPath.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label>I want to…</Label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ value, label, desc, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setRole(value)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  role === value ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${role === value ? 'text-brand-600' : 'text-ink-400'}`} />
                <span className="mt-1.5 text-sm font-semibold text-ink-900">{label}</span>
                <span className="text-xs text-ink-400">{desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Full name</Label>
          <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Password</Label>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrengthMeter password={password} />
        </div>
        <div>
          <Label>Confirm password</Label>
          <PasswordInput
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={mismatch ? 'border-red-400' : ''}
          />
          {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={loading || mismatch}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-sm text-ink-500">
          Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
