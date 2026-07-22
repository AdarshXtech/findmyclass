export function normalizeStudentName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function normalizePhoneNumber(value) {
  const compact = String(value || '').trim().replace(/\s+/g, '')
  const localNumber = compact.startsWith('+91') ? compact.slice(3) : compact
  return /^\d{10}$/.test(localNumber) ? localNumber : null
}
