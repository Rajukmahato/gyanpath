import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Nav() {
  const { user, logout } = useAuth()

  return (
    <nav className="flex items-center gap-4 px-4 py-3 border-b text-sm">
      <Link to="/" className="font-semibold">GyanPath</Link>
      {user && (
        <>
          <Link to="/my-learning">My learning</Link>
          {user.role === 'instructor' && <Link to="/instructor">Instructor dashboard</Link>}
          {(user.role === 'moderator' || user.role === 'admin') && <Link to="/moderator">Moderation queue</Link>}
          {user.role === 'admin' && <Link to="/admin/payouts">Payouts</Link>}
          <span className="ml-auto text-gray-500">{user.email}</span>
          <button onClick={logout} className="underline">Log out</button>
        </>
      )}
      {!user && (
        <span className="ml-auto">
          <Link to="/login" className="underline">Log in</Link>
        </span>
      )}
    </nav>
  )
}
