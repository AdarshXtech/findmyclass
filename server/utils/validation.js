const SECTION_PATTERN = /^[A-Za-z0-9-]{2,20}$/;
const WING_PATTERN = /^[A-C]$/i;
const UNIVERSITY_ROLL_PATTERN = /^[A-Z0-9-]{4,30}$/;

function normalizeUniversityRollNumber(input) {
  return String(input || '').trim().replace(/\s+/g, '').toUpperCase();
}

function isValidUniversityRollNumber(value) {
  return UNIVERSITY_ROLL_PATTERN.test(value);
}

function normalizeClassRollNumber(input) {
  if (input === undefined || input === null || input === '') return null;
  const parsed = Number(input);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function isValidClassRollNumber(value) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 999);
}

function normalizeSection(section) {
  return String(section || '').trim().toUpperCase();
}

function isValidSection(section) {
  return SECTION_PATTERN.test(section);
}

function normalizeWing(wing) {
  return String(wing || '').trim().toUpperCase();
}

function isValidWing(wing) {
  return WING_PATTERN.test(wing);
}

function normalizeYear(year) {
  const parsed = Number(year);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function isValidYear(year) {
  return Number.isInteger(year) && year >= 1 && year <= 8;
}

module.exports = {
  normalizeUniversityRollNumber,
  isValidUniversityRollNumber,
  normalizeClassRollNumber,
  isValidClassRollNumber,
  normalizeSection,
  isValidSection,
  normalizeWing,
  isValidWing,
  normalizeYear,
  isValidYear,
};
