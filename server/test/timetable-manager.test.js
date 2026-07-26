const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFLICT_ERROR,
  parseTimetableText,
  validateRows,
} = require('../utils/timetable-manager');

function row(overrides = {}) {
  return {
    day: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Digital Logic Design',
    teacher: 'Teacher Sharma',
    classroom: '407',
    ...overrides,
  };
}

test('validates manual rooms and special classroom mappings', () => {
  const [numbered, lab, underground, invalid] = validateRows([
    row(),
    row({ day: 'Tuesday', classroom: '414' }),
    row({ day: 'Wednesday', classroom: 'UGF014' }),
    row({ day: 'Thursday', classroom: '999' }),
  ]);
  assert.equal(numbered.parsedLocation.displayLabel, 'Floor 4 · Wing A · Room 407');
  assert.equal(lab.parsedLocation.locationName, 'Central Instrument Lab');
  assert.equal(underground.parsedLocation.displayLabel, 'Underground Floor · Wing C · Room UGF014');
  assert.equal(invalid.status, 'error');
  assert.equal(validateRows([row({ room: '407', classroom: '414' })])[0].parsedLocation.locationName, 'Central Instrument Lab');
});

test('blocks overlapping classes and parses table imports into an unsaved preview', () => {
  const conflicting = validateRows([
    row(),
    row({ startTime: '10:30', endTime: '11:30', classroom: '408' }),
  ]);
  assert.ok(conflicting.every((entry) => entry.errors.includes(CONFLICT_ERROR)));

  const preview = parseTimetableText(
    'Day | Time | Subject | Teacher | Room\nMonday | 10:00 AM - 11:00 AM | Digital Logic Design | Mr. Sharma | 407'
  );
  assert.equal(preview.length, 1);
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[0].subjectName, 'Digital Logic Design');
});
