import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client.js'

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p>If that email is registered, a reset code has been sent.</p>
          <button className="underline" onClick={() => navigate('/reset-password', { state: { email } })}>
            I have a code
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Forgot password</h1>
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Send reset code
        </button>
        <p className="text-sm text-gray-600">
          <Link to="/login" className="underline">Back to login</Link>
        </p>
      </form>
    </div>
  )
}
