import { useMemo } from 'react'
import {
  formatScheduleDate,
  formatTime,
  groupTimetableByDay,
  timeToMinutes,
  toComparableTime,
} from '../utils/timetableTime'
import { isBreakEntry } from '../utils/timetableEntry'

export function getTimetableStatus(timetable = [], now = new Date()) {
  const currentDay = now.getDay()
  const currentTime = toComparableTime(now)
  const timetableByDay = groupTimetableByDay(timetable)
  const teachingEntries = timetable.filter((entry) => !isBreakEntry(entry))
  const todayEntries = timetableByDay.get(currentDay) || []
  const todayClasses = todayEntries.filter((entry) => !isBreakEntry(entry))
  const availableClasses = todayClasses.filter((entry) => entry.status !== 'cancelled' && !entry.cancelled)
  const firstClass = availableClasses[0] || null
  const activeEntry = availableClasses.find((entry) => (
    entry.startTime <= currentTime && entry.endTime > currentTime
  )) || null
  const nextUpcomingEntry = availableClasses.find((entry) => entry.startTime > currentTime) || null
  const priorityEntry = activeEntry ?? nextUpcomingEntry
  const beforeFirstClass = Boolean(firstClass && currentTime < firstClass.startTime)
  const locationStatus = activeEntry
    ? 'Current class'
    : beforeFirstClass
      ? 'First class today'
      : nextUpcomingEntry
        ? 'Next class'
        : null
  const minutesUntilPriority = priorityEntry
    ? timeToMinutes(priorityEntry.startTime) - timeToMinutes(currentTime)
    : null
  const timeContext = activeEntry
    ? `Started at ${formatTime(activeEntry.startTime)} · Ends at ${formatTime(activeEntry.endTime)}`
    : priorityEntry && minutesUntilPriority > 0 && minutesUntilPriority <= 60
      ? `Starts in ${minutesUntilPriority} ${minutesUntilPriority === 1 ? 'minute' : 'minutes'}`
      : priorityEntry
        ? `Starts at ${formatTime(priorityEntry.startTime)}`
        : null
  const entryStatusById = new Map(timetable.map((entry) => {
    if (isBreakEntry(entry)) return [entry.id, 'break']
    if (entry.status === 'cancelled' || entry.cancelled) return [entry.id, 'cancelled']
    if (entry.id === activeEntry?.id) return [entry.id, 'current']
    if (entry.id === priorityEntry?.id) return [entry.id, 'next']
    if (entry.dayOfWeek === currentDay && entry.endTime <= currentTime) return [entry.id, 'completed']
    return [entry.id, 'upcoming']
  }))

  return {
    activeEntry,
    currentDay,
    currentTime,
    entryStatusById,
    firstClass,
    finishedForToday: availableClasses.length > 0 && !priorityEntry,
    formattedDate: formatScheduleDate(now),
    locationStatus,
    nextUpcomingEntry,
    priorityEntry,
    shouldAutoExpandToday: Boolean(
      activeEntry || (minutesUntilPriority >= 0 && minutesUntilPriority <= 90)
    ),
    subjectCount: new Set(
      teachingEntries.map((entry) => entry.subjectCode || entry.subjectName)
    ).size,
    teachingEntries,
    timetableByDay,
    timeContext,
    todayClasses,
    todayEntries,
  }
}

export default function useTimetableStatus(timetable = [], now = new Date()) {
  return useMemo(() => getTimetableStatus(timetable, now), [now, timetable])
}
