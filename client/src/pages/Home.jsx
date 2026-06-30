import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Home() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
      <h1 className="text-2xl font-semibold text-gray-800">GyanPath</h1>
      <p className="text-gray-600">
        Logged in as {user.email} ({user.role})
        {user.mfaEnabled ? ' · MFA on' : ''}
      </p>
      {!user.mfaEnabled && (
        <Link to="/mfa-setup" className="underline text-sm">
          Set up two-factor authentication
        </Link>
      )}
      <button className="underline text-sm" onClick={logout}>
        Log out
      </button>
    </div>
  )
}
