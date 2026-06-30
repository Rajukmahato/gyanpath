import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client.js'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.register({ email, password, name })
      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      setError(err.body?.reasons?.join(', ') || err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Create account</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <PasswordStrengthMeter password={password} />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Register
        </button>
        <p className="text-sm text-gray-600">
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}
