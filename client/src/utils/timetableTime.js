export const WEEKDAYS = [
  { id: 1, name: 'Monday', shortName: 'MON' },
  { id: 2, name: 'Tuesday', shortName: 'TUE' },
  { id: 3, name: 'Wednesday', shortName: 'WED' },
  { id: 4, name: 'Thursday', shortName: 'THU' },
  { id: 5, name: 'Friday', shortName: 'FRI' },
  { id: 6, name: 'Saturday', shortName: 'SAT' },
]

export function formatTime(value) {
  const [hourValue, minute = '00'] = String(value || '').split(':')
  const hour = Number(hourValue)
  if (!Number.isInteger(hour)) return value
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function sortByStartTime(entries) {
  return [...entries].sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)))
}

export function groupTimetableByDay(entries) {
  const grouped = new Map(WEEKDAYS.map((day) => [day.id, []]))
  for (const entry of entries || []) {
    if (grouped.has(entry.dayOfWeek)) grouped.get(entry.dayOfWeek).push(entry)
  }
  for (const [day, dayEntries] of grouped) grouped.set(day, sortByStartTime(dayEntries))
  return grouped
}

export function toComparableTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number)
  return Number.isInteger(hours) && Number.isInteger(minutes)
    ? hours * 60 + minutes
    : null
}

export function formatScheduleDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
