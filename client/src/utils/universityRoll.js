export function normalizeUniversityRollNumber(input) {
  return String(input || '').trim().replace(/\s+/g, '').toUpperCase()
}

export function isValidUniversityRollNumber(value) {
  return /^[A-Z0-9-]{4,30}$/.test(value)
}
