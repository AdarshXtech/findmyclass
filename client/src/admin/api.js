import axios from 'axios'
import { getAdminCsrfToken } from './auth'

const apiRoot = (import.meta.env.VITE_API_BASE_URL || '').trim()
const baseURL = apiRoot ? `${apiRoot.replace(/\/$/, '')}/api/admin` : '/api/admin'

const adminApi = axios.create({
  baseURL,
  withCredentials: true,
})

adminApi.interceptors.request.use((config) => {
  const csrfToken = getAdminCsrfToken()
  if (csrfToken && !['get', 'head', 'options'].includes(String(config.method || 'get').toLowerCase())) config.headers['X-CSRF-Token'] = csrfToken
  return config
})

export default adminApi
