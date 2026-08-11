const crypto = require('node:crypto');

function normalizeStudentName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizePhoneNumber(value) {
  const compact = String(value || '').trim().replace(/\s+/g, '');
  const localNumber = compact.startsWith('+91') ? compact.slice(3) : compact;
  return /^\d{10}$/.test(localNumber) ? localNumber : null;
}

function hashPhoneNumber(phoneNumber, secret = process.env.PHONE_LOOKUP_SECRET) {
  if (!phoneNumber || !secret) return null;
  return crypto.createHmac('sha256', secret).update(phoneNumber).digest('hex');
}

function hashStudentLookupIdentity(normalizedName, phoneNumber, secret = process.env.PHONE_LOOKUP_SECRET) {
  if (!normalizedName || !phoneNumber || !secret) return null;
  return crypto.createHmac('sha256', secret).update(`${phoneNumber}\0${normalizedName}`).digest('hex');
}

function maskPhoneNumber(phoneNumber) {
  return phoneNumber ? `******${phoneNumber.slice(-4)}` : null;
}

module.exports = {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
  hashStudentLookupIdentity,
  maskPhoneNumber,
};
