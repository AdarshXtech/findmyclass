const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFLICT_ERROR,
  DUPLICATE_ERROR,
  matchCoordinatorToFaculty,
  parseTimetableCoordinator,
  parseTimetableText,
  shiftRows,
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

test('extracts class coordinator details without treating them as timetable rows', () => {
  const text = [
    'Day | Time | Subject | Teacher | Room',
    'Monday | 10:00 AM - 11:00 AM | Digital Logic Design | Mr. Sharma | 407',
    'Class Coordinator: Ms. Jyoti Yadav Mobile No.: +91 98765-43210',
  ].join('\n');

  assert.deepEqual(parseTimetableCoordinator(text), {
    name: 'Ms. Jyoti Yadav',
    phoneNumber: '9876543210',
  });
  assert.equal(parseTimetableText(text).length, 1);
  assert.equal(parseTimetableText('Monday\nClass Coordinator: Ms. Jyoti Yadav Mobile No.: 98765-43210').length, 0);
  assert.equal(parseTimetableCoordinator('Monday 10:00-11:00 Physics Dr. Rao 407'), null);
  assert.deepEqual(
    matchCoordinatorToFaculty({ name: 'Ms. Jvoti Yadav', phoneNumber: '' }, [{ facultyName: 'Ms. Jyoti Yadav' }]),
    { name: 'Ms. Jyoti Yadav', phoneNumber: '' }
  );
});

test('turns a pasted BBDU timetable matrix into editable rows', () => {
  const rows = parseTimetableText([
    'Time/Day | 09 to 10 | 10 to 11 | 11 to 12 | 12 to 1 | 1 to 2 | 2 to 3 | 3 to 4 | 4 to 5',
    'Mon | L/DSUC/GS/409 | L/DM/SM/409 | LIB | L/CAIT/US/606 | L | P/DS/GS/Lab3 | | L/AIMES/MS/405',
  ].join('\n'));

  assert.equal(rows.length, 7);
  assert.deepEqual(
    rows.map(({ day, startTime, endTime, subjectName, sessionType }) => (
      { day, startTime, endTime, subjectName, sessionType }
    )),
    [
      { day: 'Monday', startTime: '09:00', endTime: '10:00', subjectName: 'Data Structure using C', sessionType: 'Lecture' },
      { day: 'Monday', startTime: '10:00', endTime: '11:00', subjectName: 'Discrete Mathematics', sessionType: 'Lecture' },
      { day: 'Monday', startTime: '11:00', endTime: '12:00', subjectName: 'Library', sessionType: 'Library' },
      { day: 'Monday', startTime: '12:00', endTime: '13:00', subjectName: 'Complex Analysis and Integral Transforms', sessionType: 'Lecture' },
      { day: 'Monday', startTime: '13:00', endTime: '14:00', subjectName: 'Lunch Break', sessionType: 'Lunch Break' },
      { day: 'Monday', startTime: '14:00', endTime: '16:00', subjectName: 'Data Structure Lab', sessionType: 'Practical' },
      { day: 'Monday', startTime: '16:00', endTime: '17:00', subjectName: 'Artificial Intelligence in Mechanical Engineering Systems', sessionType: 'Lecture' },
    ]
  );
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

test('applies entry-type validation without requiring rooms for non-class periods', () => {
  const [lunch, freePeriod, lab, externalExam] = validateRows([
    row({ day: 'Monday', subject: 'Lunch', teacher: '', classroom: '', sessionType: 'Lunch Break' }),
    row({ day: 'Tuesday', subject: 'Free Period', teacher: '', classroom: '', sessionType: 'Free Period' }),
    row({ day: 'Wednesday', subject: 'DLD Lab', teacher: 'Mr. Sharma', classroom: '', sessionType: 'Lab' }),
    row({ day: 'Thursday', subject: 'University Exam', teacher: '', classroom: '', sessionType: 'Exam', external: true }),
  ]);

  assert.equal(lunch.status, 'valid');
  assert.equal(lunch.parsedLocation, null);
  assert.equal(freePeriod.reviewStatus, 'Free Period - No Room Required');
  assert.equal(lab.reviewStatus, 'Invalid Classroom');
  assert.equal(externalExam.status, 'valid');
});

test('previews valid shifts and blocks shifts that overlap another class', () => {
  const shifted = shiftRows([
    row({ timetableEntryId: 1, startTime: '11:00', endTime: '12:00' }),
  ], { direction: 'later', minutes: 20 });
  assert.equal(shifted[0].startTime, '11:20');
  assert.equal(shifted[0].endTime, '12:20');
  assert.equal(shifted[0].status, 'valid');

  const conflict = shiftRows([
    row({ timetableEntryId: 1, startTime: '11:00', endTime: '12:00' }),
  ], { direction: 'later', minutes: 20 }, [
    row({ timetableEntryId: 2, startTime: '12:00', endTime: '13:00', subject: 'Physics' }),
  ]);
  assert.equal(conflict[0].reviewStatus, 'Conflict');
});
