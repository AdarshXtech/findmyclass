export function formatStudentName(name) {
  return String(name || '').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatSection(section) {
  return String(section || '').replace(/^(CSAI)(\d)([A-Z])$/, '$1 $2$3')
}
