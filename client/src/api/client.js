const API_URL = import.meta.env.VITE_API_URL

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'request failed')
    error.status = res.status
    error.body = data
    throw error
  }
  return data
}

export async function refreshAccessToken() {
  const data = await request('/api/auth/refresh', { method: 'POST', auth: false })
  setAccessToken(data.accessToken)
  return data.accessToken
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body, auth: false }),
  verifyOtp: (body) => request('/api/auth/otp/verify', { method: 'POST', body, auth: false }),
  login: (body) => request('/api/auth/login', { method: 'POST', body, auth: false }),
  verifyMfaLogin: (body) => request('/api/auth/mfa/login-verify', { method: 'POST', body, auth: false }),
  setupMfa: () => request('/api/auth/mfa/setup', { method: 'POST' }),
  enableMfa: (body) => request('/api/auth/mfa/enable', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  requestPasswordReset: (body) => request('/api/auth/password-reset/request', { method: 'POST', body, auth: false }),
  confirmPasswordReset: (body) => request('/api/auth/password-reset/confirm', { method: 'POST', body, auth: false }),

  listCourses: (category) => request(`/api/courses${category ? `?category=${category}` : ''}`, { auth: false }),
  getCourse: (id) => request(`/api/courses/${id}`, { auth: false }),
  createCourse: (body) => request('/api/courses', { method: 'POST', body }),
  myCourses: () => request('/api/courses/mine'),
  updateCourse: (id, body) => request(`/api/courses/${id}`, { method: 'PATCH', body }),
  submitCourse: (id) => request(`/api/courses/${id}/submit`, { method: 'POST' }),
  addLesson: (id, body) => request(`/api/courses/${id}/lessons`, { method: 'POST', body }),
  pendingCourses: () => request('/api/courses/pending'),
  reviewCourse: (id, decision) => request(`/api/courses/${id}/review`, { method: 'POST', body: { decision } }),
  checkout: (id) => request(`/api/courses/${id}/checkout`, { method: 'POST' }),

  getSignedUrl: (lessonId) => request(`/api/content/${lessonId}/signed-url`, { method: 'POST' }),

  myEnrollments: () => request('/api/enrollments/mine'),
  requestRefund: (enrollmentId) => request(`/api/enrollments/${enrollmentId}/refund-request`, { method: 'POST' }),

  requestPayout: (amountNPR) => request('/api/payouts', { method: 'POST', body: { amountNPR } }),
  myPayouts: () => request('/api/payouts/mine'),
  pendingPayouts: () => request('/api/payouts/pending'),
  reviewPayout: (id, decision) => request(`/api/payouts/${id}/review`, { method: 'POST', body: { decision } }),
}
