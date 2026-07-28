// Default the API origin to the same host the app was loaded from (port 4000) so the app works
// unchanged over localhost on the dev box AND over a LAN/VM IP (e.g. pentesting from a Kali VM
// through Burp) without rebuilding. An explicit VITE_API_URL still overrides when needed.
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

async function rawFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function request(path, opts = {}) {
  let res = await rawFetch(path, opts)

  // if the short-lived access token expired mid-session, silently refresh once and retry
  // so the user isn't logged out every 15 minutes
  if (res.status === 401 && opts.auth !== false && !opts._retried && accessToken) {
    try {
      await refreshAccessToken()
      res = await rawFetch(path, opts)
    } catch {
      setAccessToken(null)
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'request failed')
    error.status = res.status
    error.body = data
    throw error
  }
  return data
}

let refreshPromise = null

// dedupes concurrent refreshes into one request — otherwise two simultaneous 401s
// would each rotate the refresh token, and the second would trip the server's
// reuse-detection and revoke the whole session
export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await rawFetch('/api/auth/refresh', { method: 'POST', auth: false })
      if (!res.ok) throw new Error('refresh failed')
      const data = await res.json()
      setAccessToken(data.accessToken)
      return data.accessToken
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function uploadFile(path, field, file) {
  const form = new FormData()
  form.append(field, file)
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, credentials: 'include', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'upload failed')
    error.status = res.status
    error.body = data
    throw error
  }
  return data
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body, auth: false }),
  verifyOtp: (body) => request('/api/auth/otp/verify', { method: 'POST', body, auth: false }),
  resendOtp: (body) => request('/api/auth/otp/resend', { method: 'POST', body, auth: false }),
  login: (body) => request('/api/auth/login', { method: 'POST', body, auth: false }),
  verifyMfaLogin: (body) => request('/api/auth/mfa/login-verify', { method: 'POST', body, auth: false }),
  setupMfa: () => request('/api/auth/mfa/setup', { method: 'POST' }),
  enableMfa: (body) => request('/api/auth/mfa/enable', { method: 'POST', body }),
  disableMfa: (body) => request('/api/auth/mfa/disable', { method: 'POST', body }),
  deleteAccount: () => request('/api/users/me', { method: 'DELETE' }),
  oauthProviders: () => request('/api/auth/oauth/providers', { auth: false }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  requestPasswordReset: (body) => request('/api/auth/password-reset/request', { method: 'POST', body, auth: false }),
  confirmPasswordReset: (body) => request('/api/auth/password-reset/confirm', { method: 'POST', body, auth: false }),
  changeExpiredPassword: (body) => request('/api/auth/password/change-expired', { method: 'POST', body, auth: false }),
  changePassword: (body) => request('/api/auth/password/change', { method: 'POST', body }),

  // WebAuthn / passkeys
  passkeyRegisterOptions: () => request('/api/auth/webauthn/register/options', { method: 'POST' }),
  passkeyRegisterVerify: (body) => request('/api/auth/webauthn/register/verify', { method: 'POST', body }),
  passkeyLoginOptions: () => request('/api/auth/webauthn/login/options', { method: 'POST', auth: false }),
  passkeyLoginVerify: (body) => request('/api/auth/webauthn/login/verify', { method: 'POST', body, auth: false }),
  listPasskeys: () => request('/api/auth/webauthn/passkeys'),
  deletePasskey: (id) => request(`/api/auth/webauthn/passkeys/${id}`, { method: 'DELETE' }),

  listCourses: (category) => request(`/api/courses${category ? `?category=${category}` : ''}`, { auth: false }),
  getCourse: (id) => request(`/api/courses/${id}`, { auth: false }),
  createCourse: (body) => request('/api/courses', { method: 'POST', body }),
  myCourses: () => request('/api/courses/mine'),
  updateCourse: (id, body) => request(`/api/courses/${id}`, { method: 'PATCH', body }),
  submitCourse: (id) => request(`/api/courses/${id}/submit`, { method: 'POST' }),
  addLesson: (id, body) => request(`/api/courses/${id}/lessons`, { method: 'POST', body }),
  uploadLessonVideo: (courseId, file) => uploadFile(`/api/courses/${courseId}/upload-video`, 'video', file),
  uploadCourseThumbnail: (courseId, file) => uploadFile(`/api/courses/${courseId}/upload-thumbnail`, 'thumbnail', file),
  pendingCourses: () => request('/api/courses/pending'),
  reviewCourse: (id, decision) => request(`/api/courses/${id}/review`, { method: 'POST', body: { decision } }),
  pendingInstructors: () => request('/api/users/instructors/pending'),
  verifyInstructor: (id) => request(`/api/users/instructors/${id}/verify`, { method: 'POST' }),
  checkout: (id) => request(`/api/courses/${id}/checkout`, { method: 'POST' }),
  confirmKhaltiPayment: (pidx) => request('/api/payments/khalti/confirm', { method: 'POST', body: { pidx } }),
  confirmEsewaPayment: (transactionUuid) => request('/api/payments/esewa/confirm', { method: 'POST', body: { transactionUuid } }),

  getSignedUrl: (lessonId) => request(`/api/content/${lessonId}/signed-url`, { method: 'POST' }),

  myEnrollments: () => request('/api/enrollments/mine'),
  myEnrollmentForCourse: (courseId) => request(`/api/enrollments/course/${courseId}`),
  requestRefund: (enrollmentId) => request(`/api/enrollments/${enrollmentId}/refund-request`, { method: 'POST' }),

  requestPayout: (amountNPR) => request('/api/payouts', { method: 'POST', body: { amountNPR } }),
  myPayouts: () => request('/api/payouts/mine'),
  pendingPayouts: () => request('/api/payouts/pending'),
  reviewPayout: (id, decision) => request(`/api/payouts/${id}/review`, { method: 'POST', body: { decision } }),

  updateProfile: (body) => request('/api/users/me', { method: 'PATCH', body }),
  exportMyData: () => request('/api/users/me/export'),
  importMyData: (body) => request('/api/users/me/import', { method: 'POST', body }),
  requestAccountDeletion: () => request('/api/users/me/delete-request', { method: 'POST' }),

  pingProgress: (lessonId, watchedSecondsDelta) =>
    request(`/api/progress/${lessonId}/ping`, { method: 'POST', body: { watchedSecondsDelta } }),

  // Admin
  adminListUsers: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request(`/api/admin/users${q ? `?${q}` : ''}`)
  },
  adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminChangeRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  adminAuditLogs: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request(`/api/admin/audit-logs${q ? `?${q}` : ''}`)
  },

  myCertificates: () => request('/api/certificates/mine'),
  verifyCertificate: (certificateId) => request(`/api/certificates/${certificateId}/verify`, { auth: false }),

  async downloadCertificate(certificateId) {
    const res = await fetch(`${API_URL}/api/certificates/${certificateId}/download`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('could not download certificate')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${certificateId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}
