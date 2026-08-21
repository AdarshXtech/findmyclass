const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasPdfSignature,
  linesFromTextItems,
  parsePdfRosterLines,
} = require('../utils/student-import-pdf');

test('recognizes PDF signatures without trusting the filename', () => {
  assert.equal(hasPdfSignature(Buffer.from('%PDF-1.7\n')), true);
  assert.equal(hasPdfSignature(Buffer.from('not a pdf')), false);
});

test('reconstructs PDF text lines by position', () => {
  const lines = linesFromTextItems([
    { str: 'CSAI2B', transform: [1, 0, 0, 1, 390, 700] },
    { str: '1', transform: [1, 0, 0, 1, 100, 700] },
    { str: 'TEST STUDENT', transform: [1, 0, 0, 1, 185, 700] },
    { str: '1250439002', transform: [1, 0, 0, 1, 115, 700] },
  ]);

  assert.deepEqual(lines, ['1 1250439002 TEST STUDENT CSAI2B']);
});

test('maps BBDU PDF roster rows and applies reviewed class defaults', () => {
  const rows = parsePdfRosterLines([
    [
      'CRoll No urollno student_name Section',
      '1 1250439002 TEST STUDENT CSAI2B',
      '2 1250439009 SECOND STUDENT CSAI2B',
    ],
  ], { course: 'B.Tech', branch: 'CSAI', year: '2' });

  assert.deepEqual(rows, [
    {
      rowNumber: 'page 1, line 2',
      class_roll_number: '1',
      university_roll_number: '1250439002',
      name: 'TEST STUDENT',
      section: 'CSAI2B',
      course: 'B.Tech',
      branch: 'CSAI',
      year: '2',
    },
    {
      rowNumber: 'page 1, line 3',
      class_roll_number: '2',
      university_roll_number: '1250439009',
      name: 'SECOND STUDENT',
      section: 'CSAI2B',
      course: 'B.Tech',
      branch: 'CSAI',
      year: '2',
    },
  ]);
});
