const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
  maskPhoneNumber,
} = require('../utils/student-identity');

test('normalizes student names without allowing partial matching', () => {
  assert.equal(normalizeStudentName('  Rudansh   Kumar Singh  '), 'RUDANSH KUMAR SINGH');
  assert.equal(normalizeStudentName('rudansh kumar singh'), 'RUDANSH KUMAR SINGH');
  assert.notEqual(normalizeStudentName('Rudansh Singh'), 'RUDANSH KUMAR SINGH');
});

test('normalizes supported Indian phone formats', () => {
  assert.equal(normalizePhoneNumber('7000000101'), '7000000101');
  assert.equal(normalizePhoneNumber('70000 00101'), '7000000101');
  assert.equal(normalizePhoneNumber('+91 7000000101'), '7000000101');
});

test('rejects malformed phone numbers and masks valid ones', () => {
  for (const value of ['', '700000101', '917000000101', '70000-00101', '70000A0101']) {
    assert.equal(normalizePhoneNumber(value), null, value);
  }
  assert.equal(maskPhoneNumber('7000000101'), '******0101');
  assert.equal(hashPhoneNumber('7000000101', 'test-secret'), hashPhoneNumber('7000000101', 'test-secret'));
  assert.notEqual(hashPhoneNumber('7000000101', 'test-secret'), hashPhoneNumber('7000000102', 'test-secret'));
});
