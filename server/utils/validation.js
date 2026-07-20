const PHONE_DIGITS = 10;
const SECTION_PATTERN = /^[A-Za-z0-9-]{2,20}$/;
const WING_PATTERN = /^[A-C]$/i;

function normalizePhone(input) {
  if (input === undefined || input === null) {
    return '';
  }

  let cleanPhone = String(input).replace(/[^\d]/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2);
  }
  return cleanPhone;
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
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
  PHONE_DIGITS,
  normalizePhone,
  isValidPhone,
  normalizeSection,
  isValidSection,
  normalizeWing,
  isValidWing,
  normalizeYear,
  isValidYear,
};
