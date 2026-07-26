import { useMemo } from 'react'
import {
  formatScheduleDate,
  groupTimetableByDay,
  timeToMinutes,
  toComparableTime,
} from '../utils/timetableTime'

export function getTimetableStatus(timetable = [], now = new Date()) {
  const currentDay = now.getDay()
  const currentTime = toComparableTime(now)
  const timetableByDay = groupTimetableByDay(timetable)
  const teachingEntries = timetable.filter((entry) => entry.sessionType !== 'Break')
  const todayEntries = timetableByDay.get(currentDay) || []
  const todayClasses = todayEntries.filter((entry) => entry.sessionType !== 'Break')
  const activeEntry = todayClasses.find((entry) => (
    entry.startTime <= currentTime && entry.endTime > currentTime
  )) || null
  const nextUpcomingEntry = todayClasses.find((entry) => entry.startTime > currentTime) || null
  const priorityEntry = activeEntry ?? nextUpcomingEntry
  const locationStatus = activeEntry ? 'Current class' : nextUpcomingEntry ? 'Next class' : null
  const minutesUntilPriority = priorityEntry
    ? timeToMinutes(priorityEntry.startTime) - timeToMinutes(currentTime)
    : null

  return {
    activeEntry,
    currentDay,
    currentTime,
    finishedForToday: todayClasses.length > 0 && !priorityEntry,
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
    todayClasses,
    todayEntries,
  }
}

export default function useTimetableStatus(timetable = [], now = new Date()) {
  return useMemo(() => getTimetableStatus(timetable, now), [now, timetable])
}
