import axios from 'axios'

const apiRoot = (import.meta.env.VITE_API_BASE_URL || '').trim()
const baseURL = apiRoot ? `${apiRoot.replace(/\/$/, '')}/api` : '/api'

const publicApi = axios.create({ baseURL })

export default publicApi
