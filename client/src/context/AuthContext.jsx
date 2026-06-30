import { createContext, useCallback, useEffect, useState } from 'react'
import { api, setAccessToken, refreshAccessToken } from '../api/client.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshAccessToken()
      .then(() => api.me())
      .then(setUser)
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password })
    if (data.mfaRequired) return data
    setAccessToken(data.accessToken)
    setUser(data.user)
    return data
  }, [])

  const verifyMfaLogin = useCallback(async (mfaToken, token) => {
    const data = await api.verifyMfaLogin({ mfaToken, token })
    setAccessToken(data.accessToken)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setAccessToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfaLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
