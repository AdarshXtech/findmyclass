const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanFacultyName, normalizeFacultyName } = require('../utils/faculty-identity');

test('normalizes harmless faculty name formatting without merging different names', () => {
  assert.equal(normalizeFacultyName('Dr. Amit Sharma'), normalizeFacultyName('DR AMIT SHARMA'));
  assert.equal(normalizeFacultyName('  Ms.  Jyoti Yadav '), 'MS JYOTI YADAV');
  assert.notEqual(normalizeFacultyName('Amit Sharma'), normalizeFacultyName('Amit Verma'));
  assert.equal(cleanFacultyName('  Dr.   Amit Sharma  '), 'Dr. Amit Sharma');
});
