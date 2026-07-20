const ADMIN_TOKEN_KEY = 'findmyclass_admin_token'
const ADMIN_USER_KEY = 'findmyclass_admin_user'

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

export function setAdminSession(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(admin || {}))
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(ADMIN_USER_KEY)
}

export function getAdminUser() {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Failed to parse stored admin user:', error)
    return null
  }
}

export function isAdminAuthenticated() {
  return Boolean(getAdminToken())
}
