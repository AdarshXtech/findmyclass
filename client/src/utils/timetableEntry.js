export const ENTRY_TYPES = ['Class', 'Lab', 'Break', 'Lunch Break', 'Free Period', 'Exam', 'Event', 'Library']

const NO_LOCATION_TYPES = new Set(['Break', 'Lunch Break', 'Free Period'])

export function isBreakEntry(entryOrType) {
  const type = typeof entryOrType === 'string' ? entryOrType : entryOrType?.sessionType
  return NO_LOCATION_TYPES.has(type)
}

export function requiresFaculty(type) {
  return ['Class', 'Lab', 'Lecture', 'Practical'].includes(type)
}

export function requiresLocation(row) {
  return ['Class', 'Lab', 'Lecture', 'Practical'].includes(row.sessionType)
    || (row.sessionType === 'Exam' && !row.external)
}
