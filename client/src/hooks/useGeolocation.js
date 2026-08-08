import { useCallback, useEffect, useRef, useState } from 'react'

function locationError(error) {
  if (error?.code === 1) return 'Location access is off. You can still browse the campus map and choose a starting point.'
  if (error?.code === 2) return 'Your location is unavailable. Choose a starting point manually.'
  if (error?.code === 3) return 'Finding your location took too long. Choose a starting point or try again.'
  return 'Your exact location could not be determined. Choose a starting point manually.'
}

export default function useGeolocation() {
  const [status, setStatus] = useState('idle')
  const [position, setPosition] = useState(null)
  const [message, setMessage] = useState('')
  const watchId = useRef(null)

  const stop = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (status === 'denied') return
    if (!navigator.geolocation) {
      setStatus('unsupported')
      setMessage('Location is not supported by this browser. Choose a starting point manually.')
      return
    }

    setStatus('loading')
    setMessage('Finding your location...')
    stop()
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({
          coordinates: [coords.latitude, coords.longitude],
          accuracy: coords.accuracy,
        })
        setStatus(coords.accuracy > 50 ? 'approximate' : 'ready')
        setMessage(coords.accuracy > 50 ? 'Your location is approximate.' : '')
      },
      (error) => {
        stop()
        setStatus(error?.code === 1 ? 'denied' : 'error')
        setMessage(locationError(error))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    )
  }, [status, stop])

  useEffect(() => stop, [stop])

  return { message, position, start, status, stop }
}
