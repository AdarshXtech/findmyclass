import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useGeolocation from './useGeolocation'

afterEach(() => {
  vi.restoreAllMocks()
  delete navigator.geolocation
})

function installGeolocation({ success, error }) {
  const clearWatch = vi.fn()
  const watchPosition = vi.fn((onSuccess, onError) => {
    if (success) onSuccess(success)
    if (error) onError(error)
    return 7
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { clearWatch, watchPosition },
  })
  return { clearWatch, watchPosition }
}

describe('useGeolocation', () => {
  it('starts location watching only after the student asks', () => {
    const api = installGeolocation({ success: { coords: { latitude: 26.88, longitude: 81.05, accuracy: 12 } } })
    const { result } = renderHook(() => useGeolocation())

    expect(api.watchPosition).not.toHaveBeenCalled()
    act(() => result.current.start())
    expect(api.watchPosition).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('ready')
    expect(result.current.position.coordinates).toEqual([26.88, 81.05])
  })

  it('reports poor GPS accuracy without pretending it is exact', () => {
    installGeolocation({ success: { coords: { latitude: 26.88, longitude: 81.05, accuracy: 80 } } })
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    expect(result.current.status).toBe('approximate')
    expect(result.current.message).toBe('Your location is approximate.')
  })

  it('does not request permission again after denial', () => {
    const api = installGeolocation({ error: { code: 1 } })
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    expect(result.current.status).toBe('denied')
    act(() => result.current.start())
    expect(api.watchPosition).toHaveBeenCalledOnce()
  })

  it('provides a manual-start message when location is unavailable', () => {
    installGeolocation({ error: { code: 2 } })
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    expect(result.current.status).toBe('error')
    expect(result.current.message).toMatch(/choose a starting point manually/i)
  })
})
