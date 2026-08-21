import { describe, expect, it } from 'vitest'
import adminApi from './api'

describe('admin API client', () => {
  it('uses the same-origin API proxy for cookie sessions', () => {
    expect(adminApi.defaults.baseURL).toBe('/api/admin')
    expect(adminApi.defaults.withCredentials).toBe(true)
  })
})
