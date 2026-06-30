import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'

export default function VerifyOtp() {
  const [email, setEmail] = useState(useLocation().state?.email || '')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Verify your email</h1>
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
          placeholder="6-digit code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Verify
        </button>
      </form>
    </div>
  )
}
