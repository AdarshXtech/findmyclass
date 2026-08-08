import { useState } from 'react'

export default function useScheduleExpansion() {
  const [todayExpanded, setTodayExpanded] = useState(false)
  const [expandedDay, setExpandedDay] = useState(null)

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
