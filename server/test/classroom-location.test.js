const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASSROOM_ERROR, parseClassroomLocation } = require('../utils/classroom-location');

test('parses numbered floors 1 through 8 and preserves leading zeroes', () => {
  assert.deepEqual(
    parseClassroomLocation('101'),
    {
      valid: true,
      isMissing: false,
      originalClassroom: '101',
      classroomNumber: '101',
      roomPosition: '01',
      floor: 'Floor 1',
      floorCode: '1',
      shortFloor: 'Floor 1',
      wing: 'A',
      fullDisplay: 'Floor 1 \u00b7 Wing A \u00b7 Classroom 101',
      shortDisplay: 'Floor 1 \u00b7 Wing A \u00b7 Room 01',
      error: null,
    }
  );

  const eighthFloor = parseClassroomLocation('821');
  assert.equal(eighthFloor.floor, 'Floor 8');
  assert.equal(eighthFloor.roomPosition, '21');
  assert.equal(eighthFloor.wing, 'C');
});

test('normalizes UGF and LGF classrooms with spaces and hyphens', () => {
  const upper = parseClassroomLocation('ugf-07');
  assert.equal(upper.classroomNumber, 'UGF07');
  assert.equal(upper.floor, 'Upper Ground Floor');
  assert.equal(upper.roomPosition, '07');
  assert.equal(upper.wing, 'A');

  const lower = parseClassroomLocation(' LGF 15 ');
  assert.equal(lower.classroomNumber, 'LGF15');
  assert.equal(lower.floor, 'Lower Ground Floor');
  assert.equal(lower.roomPosition, '15');
  assert.equal(lower.wing, 'C');
});

test('assigns every wing boundary from the final two digits', () => {
  const cases = [
    ['401', 'A'],
    ['407', 'A'],
    ['408', 'B'],
    ['414', 'B'],
    ['415', 'C'],
    ['421', 'C'],
  ];

  for (const [classroom, wing] of cases) {
    assert.equal(parseClassroomLocation(classroom).wing, wing, classroom);
  }
});

test('rejects invalid floors, positions, suffixes, and lengths', () => {
  for (const classroom of ['000', '901', '1001', 'UGF00', 'LGF22', 'ABC07', '407A']) {
    const parsed = parseClassroomLocation(classroom);
    assert.equal(parsed.valid, false, classroom);
    assert.equal(parsed.wing, null, classroom);
    assert.equal(parsed.error, CLASSROOM_ERROR, classroom);
  }
});

test('treats a missing classroom differently from an invalid classroom', () => {
  const parsed = parseClassroomLocation(null);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.isMissing, true);
  assert.equal(parsed.error, null);
});
