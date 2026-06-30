import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function RequireRole({ roles }) {
  const { user } = useAuth()

  if (!roles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
