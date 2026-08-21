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
  const value = String(section || '').trim().toUpperCase();
  const compact = value.replace(/[\s_-]+/g, '');
  const csai = compact.match(/^(?:CSAI|CSEAI)?([1-8])([A-Z])$/);
  return csai ? `CSAI${csai[1]}${csai[2]}` : value;
}

function normalizeBranch(branch) {
  const value = String(branch || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return ['CSAI', 'CSEAI'].includes(value.replace(/[\s_-]+/g, '')) ? 'CSAI' : value;
}

function parseCsaiSection(section) {
  const normalized = normalizeSection(section);
  const match = normalized.match(/^CSAI([1-8])([A-Z])$/);
  return match ? { branch: 'CSAI', year: Number(match[1]), section: normalized, sectionLetter: match[2] } : null;
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
  normalizeBranch,
  parseCsaiSection,
  isValidSection,
  normalizeWing,
  isValidWing,
  normalizeYear,
  isValidYear,
};
