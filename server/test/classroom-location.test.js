const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLASSROOM_ERROR,
  getClassroomLocationOptions,
  parseClassroomLocation,
} = require('../utils/classroom-location');

function assertWing(room, wing) {
  const location = parseClassroomLocation(room);
  assert.equal(location.isValid, true, room);
  assert.equal(location.wing, wing, room);
}

test('normalizes and maps Underground Floor rooms', () => {
  for (const room of ['UGF001', 'UGF007']) assertWing(room, 'A');
  for (const room of ['UGF008', 'UGF013']) assertWing(room, 'B');
  for (const room of ['UGF014', 'UGF020']) assertWing(room, 'C');

  const normalized = parseClassroomLocation(' ugf-001 ');
  assert.equal(normalized.classroomNumber, 'UGF001');
  assert.equal(normalized.floor, 'UGF');
  assert.equal(normalized.floorLabel, 'Underground Floor');
  assert.equal(normalized.displayLabel, 'Underground Floor \u00b7 Wing A \u00b7 Room UGF001');
});

test('maps every corrected numbered-floor boundary', () => {
  const cases = [
    ['501', 'A'], ['507', 'A'], ['508', 'B'], ['514', 'B'], ['515', 'C'], ['520', 'C'],
    ['401', 'A'], ['407', 'A'], ['408', 'B'], ['413', 'B'], ['415', 'C'], ['419', 'C'],
    ['301', 'A'], ['307', 'A'], ['308', 'B'], ['314', 'B'], ['315', 'C'], ['321', 'C'],
    ['201', 'A'], ['207', 'A'], ['208', 'B'], ['214', 'B'], ['215', 'C'], ['221', 'C'],
    ['101', 'A'], ['107', 'A'], ['108', 'B'], ['114', 'B'], ['115', 'C'], ['120', 'C'],
  ];

  for (const [room, wing] of cases) assertWing(room, wing);
});

test('maps Central Instrument Lab by room number or name', () => {
  for (const input of ['414', 'Central Instrument Lab']) {
    const location = parseClassroomLocation(input);
    assert.equal(location.isValid, true);
    assert.equal(location.floor, '4');
    assert.equal(location.floorLabel, 'Floor 4');
    assert.equal(location.wing, null);
    assert.equal(location.room, '414');
    assert.equal(location.locationName, 'Central Instrument Lab');
    assert.equal(location.displayLabel, 'Floor 4 \u00b7 Central Instrument Lab');
    assert.equal(location.shortLabel, 'Central Instrument Lab');
    assert.equal(location.isSpecialLocation, true);
  }
});

test('maps Central Library and the observed LIB timetable alias', () => {
  const inputs = [
    ['Central Library'],
    ['LIB'],
    [null, { subjectName: 'Library', sessionType: 'Library' }],
  ];

  for (const [input, context] of inputs) {
    const location = parseClassroomLocation(input, context);
    assert.equal(location.isValid, true);
    assert.equal(location.floor, '6');
    assert.equal(location.wing, 'B');
    assert.equal(location.room, null);
    assert.equal(location.locationName, 'Central Library');
    assert.equal(location.displayLabel, 'Floor 6 \u00b7 Wing B \u00b7 Central Library');
    assert.equal(location.isSpecialLocation, true);
  }
});

test('rejects every room outside the corrected building map', () => {
  const invalidRooms = [
    '521', '420', '422', '322', '222', '121', '100',
    'UGF000', 'UGF021', 'UGF01', 'LGF001', 'ABC407', '601', '821',
  ];

  for (const room of invalidRooms) {
    const location = parseClassroomLocation(room);
    assert.equal(location.isValid, false, room);
    assert.equal(location.floor, null, room);
    assert.equal(location.wing, null, room);
    assert.equal(location.locationName, null, room);
    assert.equal(location.error, CLASSROOM_ERROR, room);
  }
});

test('generates only valid options for the admin editor', () => {
  const options = getClassroomLocationOptions();
  assert.ok(options.length > 100);
  assert.ok(options.every((option) => option.isValid));
  assert.equal(options.filter((option) => option.locationName === 'Central Library').length, 1);
  assert.equal(options.filter((option) => option.locationName === 'Central Instrument Lab').length, 1);
});

test('treats a missing classroom differently from an invalid classroom', () => {
  const location = parseClassroomLocation(null);
  assert.equal(location.isValid, false);
  assert.equal(location.isMissing, true);
  assert.equal(location.error, null);
});
