import axios from 'axios'

const AUTH_STORAGE_KEY = 'cablix_auth_session'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export function readStoredSession() {
  try {
    const value = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function storeSession(session) {
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession() {
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials)
  return response.data.data
}

export async function refreshSession(refreshToken) {
  const response = await api.post('/auth/refresh-token', { refreshToken })
  return response.data.data
}

export async function validateSession(session) {
  const endpoint = session.user.userType === 'PLATFORM' ? '/platform/me' : '/tenant/me'
  await api.get(endpoint, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  return session
}

export async function logout(refreshToken) {
  if (refreshToken) {
    await api.post('/auth/logout', { refreshToken })
  }
}

export function getAuthErrorMessage(error) {
  return error.response?.data?.message || 'Unable to sign in. Check your details and try again.'
}
