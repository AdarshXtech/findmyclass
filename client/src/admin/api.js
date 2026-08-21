import axios from 'axios'
import { getAdminCsrfToken } from './auth'

const adminApi = axios.create({
  baseURL: '/api/admin',
  withCredentials: true,
})

adminApi.interceptors.request.use((config) => {
  const csrfToken = getAdminCsrfToken()
  if (csrfToken && !['get', 'head', 'options'].includes(String(config.method || 'get').toLowerCase())) config.headers['X-CSRF-Token'] = csrfToken
  return config
})

export default adminApi
