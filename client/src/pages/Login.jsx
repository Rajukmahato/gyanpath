import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      const data = await login(email, password)
      if (data.mfaRequired) {
        navigate('/mfa-challenge', { state: { mfaToken: data.mfaToken } })
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.body?.error === 'account temporarily locked, try again later' ? err.body.error : err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Log in</h1>
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
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Log in
        </button>
        <p className="text-sm text-gray-600 flex justify-between">
          <Link to="/register" className="underline">Create account</Link>
          <Link to="/forgot-password" className="underline">Forgot password?</Link>
        </p>
      </form>
    </div>
  )
}
