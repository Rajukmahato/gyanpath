import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

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
      await verifyMfaLogin(mfaToken, token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  if (!mfaToken) return <p className="p-6">Start by logging in first.</p>

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Enter your authenticator code</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="6-digit code"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Verify
        </button>
      </form>
    </div>
  )
}
