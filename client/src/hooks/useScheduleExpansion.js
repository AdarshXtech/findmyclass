import { useEffect, useState } from 'react'

export default function useScheduleExpansion(currentDay, autoExpandToday = false) {
  const [todayExpanded, setTodayExpanded] = useState(autoExpandToday)
  const [expandedDay, setExpandedDay] = useState(() => (
    currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  ))

  useEffect(() => {
    if (autoExpandToday) setTodayExpanded(true)
  }, [autoExpandToday])

  return {
    expandedDay,
    todayExpanded,
    toggleDay(day) {
      setExpandedDay((current) => current === day ? null : day)
    },
    toggleToday() {
      setTodayExpanded((current) => !current)
    },
  }
}
