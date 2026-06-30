import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

export default function ResetPassword() {
  const [email, setEmail] = useState(useLocation().state?.email || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.confirmPasswordReset({ email, code, newPassword })
      navigate('/login')
    } catch (err) {
      setError(err.body?.reasons?.join(', ') || err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Reset password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Reset code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="New password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={newPassword} />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Reset password
        </button>
      </form>
    </div>
  )
}
