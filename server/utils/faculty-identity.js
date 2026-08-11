function cleanFacultyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeFacultyName(value) {
  return cleanFacultyName(value)
    .toUpperCase()
    .replace(/\b(DR|MR|MS|MRS|PROF)\./g, '$1')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = { cleanFacultyName, normalizeFacultyName };
