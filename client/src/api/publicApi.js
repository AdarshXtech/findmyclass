import axios from 'axios'

const apiRoot = (import.meta.env.VITE_API_BASE_URL || '').trim()
const baseURL = apiRoot ? `${apiRoot.replace(/\/$/, '')}/api` : '/api'

const publicApi = axios.create({ baseURL })

const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function lookupStudentSchedule(universityRollNumber, { onRetry } = {}) {
  let lastError

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await publicApi.post('/student/lookup', {
        university_roll_number: universityRollNumber,
      })
    } catch (error) {
      lastError = error
      const status = error.response?.status
      const canRetry = !error.response || transientStatuses.has(status)

      if (!canRetry || attempt === 1) throw error
      onRetry?.()
      await wait(1500)
    }
  }

  throw lastError
}

export default publicApi
