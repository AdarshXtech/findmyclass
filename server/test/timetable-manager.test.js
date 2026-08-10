const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFLICT_ERROR,
  DUPLICATE_ERROR,
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
  const databaseRow = validateRows([row({
    day: undefined,
    day_of_week: 5,
    subject: undefined,
    subject_name: 'Data Structures',
    teacher: undefined,
    faculty_name: 'Ms. Jyoti Yadav',
  })])[0];
  assert.equal(databaseRow.day, 'Friday');
  assert.equal(databaseRow.subjectName, 'Data Structures');
  assert.equal(databaseRow.facultyName, 'Ms. Jyoti Yadav');
});

test('blocks overlapping classes and parses table imports into an unsaved preview', () => {
  const conflicting = validateRows([
    row(),
    row({ startTime: '10:30', endTime: '11:30', subject: 'Data Structures', classroom: '408' }),
  ]);
  assert.ok(conflicting.every((entry) => entry.errors.some((error) => error.startsWith(CONFLICT_ERROR))));
  assert.match(conflicting[0].errors.join(' '), /Data Structures/);
  assert.match(conflicting[1].errors.join(' '), /Digital Logic Design/);

  const preview = parseTimetableText(
    'Day | Time | Subject | Teacher | Room\nMonday | 10:00 AM - 11:00 AM | Digital Logic Design | Mr. Sharma | 407'
  );
  assert.equal(preview.length, 1);
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[0].subjectName, 'Digital Logic Design');

  const [lowerGroundLab] = parseTimetableText(
    'Tuesday 11:00 AM - 12:00 PM Digital Logic Design Mr. Sharma LGF-001'
  );
  assert.equal(lowerGroundLab.room, 'LGF001');
  assert.equal(lowerGroundLab.parsedLocation.fullLocationName, 'Digital Logic Design Lab');
});

test('accepts lunch breaks, rejects Saturday, and reports exact duplicates', () => {
  const [lunch] = validateRows([{
    day: 'Friday',
    startTime: '13:00',
    endTime: '14:00',
    subject: 'Lunch break',
    sessionType: 'Break',
  }]);
  assert.equal(lunch.status, 'valid');
  assert.equal(lunch.facultyName, '');
  assert.equal(lunch.room, '');

  assert.equal(validateRows([row({ day: 'Saturday' })])[0].status, 'error');

  const duplicates = validateRows([row(), row()]);
  assert.ok(duplicates.every((entry) => entry.errors.includes(DUPLICATE_ERROR)));

  const [importedLunch] = parseTimetableText(
    'Day | Time | Subject | Teacher | Room | Type\nFriday | 1:00 PM - 2:00 PM | Lunch break | | | Break'
  );
  assert.equal(importedLunch.status, 'valid');
  assert.equal(importedLunch.sessionType, 'Break');
});

test('accepts Library and Break entries without faculty', () => {
  const [library, breakEntry] = validateRows([
    row({ day: 'Tuesday', subject: 'Library', teacher: '', classroom: '', sessionType: 'Library' }),
    row({ day: 'Wednesday', subject: 'Lunch break', teacher: '', classroom: '', sessionType: 'Break' }),
  ]);

  assert.equal(library.status, 'valid');
  assert.equal(library.facultyName, '');
  assert.equal(library.parsedLocation.locationName, 'Central Library');
  assert.equal(breakEntry.status, 'valid');
  assert.equal(breakEntry.facultyName, '');
});
