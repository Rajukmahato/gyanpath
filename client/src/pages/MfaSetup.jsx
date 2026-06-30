import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

export default function MfaSetup() {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.setupMfa().then((data) => setQrDataUrl(data.qrDataUrl))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.enableMfa({ token })
      setDone(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (done) return <p className="p-6">Two-factor authentication is now enabled on your account.</p>

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold">Set up two-factor authentication</h1>
        {qrDataUrl && <img src={qrDataUrl} alt="MFA QR code" className="mx-auto" />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Enter the 6-digit code"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button className="w-full bg-gray-900 text-white rounded px-3 py-2" type="submit">
          Enable
        </button>
      </form>
    </div>
  )
}
