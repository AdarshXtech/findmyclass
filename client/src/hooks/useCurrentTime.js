import { useEffect, useState } from 'react'

export default function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(clock)
  }, [])

  return now
}
