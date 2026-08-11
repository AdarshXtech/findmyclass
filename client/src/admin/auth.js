const ADMIN_USER_KEY = 'findmyclass_admin_user'
const ADMIN_CSRF_KEY = 'findmyclass_admin_csrf'

export function getAdminCsrfToken() {
  return sessionStorage.getItem(ADMIN_CSRF_KEY) || ''
}

export function setAdminSession(admin, csrfToken = '') {
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(admin || {}))
  if (csrfToken) sessionStorage.setItem(ADMIN_CSRF_KEY, csrfToken)
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_USER_KEY)
  sessionStorage.removeItem(ADMIN_CSRF_KEY)
}

export function getAdminUser() {
  try {
    const raw = sessionStorage.getItem(ADMIN_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Failed to parse stored admin user:', error)
    return null
  }
}

export function isAdminAuthenticated() {
  return Boolean(getAdminUser())
}
