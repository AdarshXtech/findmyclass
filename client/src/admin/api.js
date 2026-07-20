import axios from 'axios'
import { getAdminToken } from './auth'

const apiRoot = (import.meta.env.VITE_API_BASE_URL || '').trim()
const baseURL = apiRoot ? `${apiRoot.replace(/\/$/, '')}/api/admin` : '/api/admin'

const adminApi = axios.create({
  baseURL,
})

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default adminApi
