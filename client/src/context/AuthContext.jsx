import { createContext, useCallback, useEffect, useState } from 'react'
import { api, setAccessToken, refreshAccessToken } from '../api/client.js'
import { setLanguage } from '../i18n/index.js'

export const AuthContext = createContext(null)

function applyUser(setUser, user) {
  if (user?.profile?.language) setLanguage(user.profile.language)
  setUser(user)
}

// the real refresh cookie is httpOnly; this readable marker lets us skip the
// refresh call entirely for anonymous visitors instead of firing a 401 on every load
function hasSessionHint() {
  return document.cookie.split('; ').some((c) => c.startsWith('hasSession='))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasSessionHint()) {
      setLoading(false)
      return
    }
    refreshAccessToken()
      .then(() => api.me())
      .then((u) => applyUser(setUser, u))
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false))
  }, [])

  // after authenticating, load the full user (profile, mfaEnabled, …) so every page
  // sees a consistent object — the login response only carries id/email/role
  const login = useCallback(async (email, password, captchaToken) => {
    const body = { email, password }
    if (captchaToken) body.captchaToken = captchaToken
    const data = await api.login(body)
    if (data.mfaRequired) return data
    if (data.captchaRequired) return data
    setAccessToken(data.accessToken)
    applyUser(setUser, await api.me())
    return data
  }, [])

  const verifyMfaLogin = useCallback(async (mfaToken, token) => {
    const data = await api.verifyMfaLogin({ mfaToken, token })
    setAccessToken(data.accessToken)
    applyUser(setUser, await api.me())
    return data
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setAccessToken(null)
    setUser(null)
  }, [])

  // call this after any change that should be reflected globally (avatar, profile, MFA)
  const refreshUser = useCallback(async () => {
    const u = await api.me()
    applyUser(setUser, u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfaLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
