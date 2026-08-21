const assert = require('node:assert/strict');
const test = require('node:test');
const { extractGridRowsFromOcrData } = require('../utils/timetable-ocr');

function line(text, y, words) {
  return {
    text,
    bbox: { x0: words[0][1], y0: y, x1: words.at(-1)[2], y1: y + 12 },
    words: words.map(([word, x0, x1]) => ({ text: word, bbox: { x0, y0: y, x1, y1: y + 12 } })),
  };
}

test('reconstructs OCR-distorted BBDU rows and merged time slots', () => {
  const lines = [
    line('Time/Day 09 to 10 10 to 11 11 to 12 12 to 1 1 to 2 2 to 3 3 to 4 4 to 5', 10, [
      ['Time/Day', 20, 60], ['09to10', 111, 156], ['10to11', 224, 266], ['11to12', 331, 375],
      ['12to1', 445, 482], ['1to2', 534, 565], ['2to3', 616, 648], ['3to4', 730, 762], ['4to5', 843, 875],
    ]),
    line('Mon', 53, [['Mon', 32, 58]]),
    line('Tue', 96, [
      ['Tue', 32, 58], ['UDSUC/GS/A09', 87, 181], ['LIDMISM/A409', 204, 286], ['us', 342, 363],
      ['LICAIT/US', 417, 481], ['/606', 490, 510], ['U', 545, 553], ['P/DS/GS/Lab3', 645, 734], ['L/AIMES/MS/405', 808, 910],
    ]),
    line('Wed', 140, [
      ['Wed', 32, 58], ['L/CAIT/USA08', 89, 178], ['LDMISMA0S', 204, 286], ['P/DLD/VS/LGF001', 351, 470],
      ['N', 544, 553], ['UDSUC/GS/403', 585, 679], ['/AIMES/MS/403', 695, 797], ['L/DLD/VS/409', 816, 902],
    ]),
    line('Thu', 174, [
      ['Thu', 32, 58], ['LAS/PV/408', 99, 168], ['L/DLD/VS/A408', 202, 288], ['P/NSS/YOGA/VD/CH', 342, 480],
      ['C', 544, 553], ['UDSUC/GS/08', 585, 679], ['LICAIT/US/407', 701, 791], ['L/AIMES/MS/405', 808, 910],
    ]),
    line('Fri', 226, [
      ['Fri', 32, 58], ['LDSUC/GS/409', 87, 181], ['LAIMESMS/409', 194, 296], ['LASPV/A408', 318, 387],
      ['LDLDVSA08', 421, 506], ['H', 544, 553], ['LICAIT/US/409', 586, 679], ['L/DM/SM/A408', 705, 787],
    ]),
  ];
  const text = [
    '4 NBS4301 | Complex Analysis and Integral Transforms  LICAIT/US  Mr. U. S. Shukla',
    '3 NCS4301 | Discrete Mathematics  L/DM/SM  Ms. Surabhi Mishra',
    '4 NCS4302 | Data Structure using C  L/DSUC/GS  Mr. Gaurav Singh',
    '3 NCS4303 | Digital Logic Design  L/DLDVS  Mr. Vivek Singh',
    '4 NAI4302 | Artificial Intelligence  AIMES/MS  Mr. Manoj Soni',
    '2 NHS4302 | Industrial Sociology  LIS/PV  Dr. Pooja Verma',
    '1 NCS4352 | Data Structure Lab  P/DS/GS  Mr. Gaurav Singh',
    '1 NCS4353 | Digital Logic Design Lab  PDLD/VS  Mr. Vivek Singh',
    '1 NCC4351 | NSS/YOGA  PINSS/YOGA/VD  Ms. Veena Dwivedi',
  ].join('\n');

  const rows = extractGridRowsFromOcrData({ text, blocks: [{ paragraphs: [{ lines }] }] });
  const classRows = rows.filter((row) => row.sessionType !== 'Break');

  assert.equal(rows.length, 28);
  assert.deepEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
    classRows.filter((row) => row.day === day).length
  )), [0, 6, 6, 6, 6]);
  assert.equal(rows.filter((row) => row.sessionType === 'Break').length, 4);
  assert.ok(classRows.find((row) => row.classroom === 'Lab3'));
  assert.deepEqual(
    classRows.filter((row) => ['Lab3', 'LGF001', 'CH'].includes(row.classroom)).map((row) => [row.startTime, row.endTime]),
    [['14:00', '16:00'], ['11:00', '13:00'], ['11:00', '13:00']]
  );
  assert.equal(classRows.find((row) => row.day === 'Thursday' && row.startTime === '14:00').classroom, '408');
  assert.equal(rows.some((row) => row.day === 'Saturday'), false);
});

test('infers timetable rows when OCR misses day labels and reads Credit as Codes', () => {
  const lines = [
    line('B.Tech Second Year, Odd Semester Academic Session: 2026-27', 104, [
      ['Academic', 704, 801], ['Session:', 809, 886], ['2026-27', 895, 974],
    ]),
    line('L/DM/SM/414 L/CAIT/US/409', 229, [
      ['L/DM/SM/414', 198, 305], ['L/CAIT/US/409', 332, 449],
    ]),
    line('P/DS/SP/Labl L/DSUC/SP/408', 282, [
      ['P/DS/SP/Labl', 257, 371], ['L/DSUC/SP/408', 465, 586],
    ]),
    line('L/DLD/VS/407', 401, [['L/DLD/VS/407', 470, 581]]),
    line('L/IS/PV/408 LIB', 458, [['L/IS/PV/408', 834, 925], ['LIB', 1137, 1165]]),
    line('Credit', 526, [['Credit', 114, 162]]),
  ];
  const text = [
    '3 NCS4301 Discrete Mathematics L/DM/SM Ms. Surabhi Mishra',
    '4 NBS4301 Complex Analysis and Integral Transforms L/CAIT/US Mr. U.S. Shukla',
    '4 NCS4302 Data Structure using C L/DSUC/SP Ms. Sapna Pal',
    '1 NCS4352 Data Structure Lab P/DS/SP Ms. Sapna Pal',
    '3 NCS4303 Digital Logic Design L/DLD/VS Mr. Vivek Kumar Singh',
    '2 NHS4302 Industrial Sociology L/IS/PV Dr. Pooja Verma',
  ].join('\n');

  const rows = extractGridRowsFromOcrData({ text, blocks: [{ paragraphs: [{ lines }] }] });
  const classRows = rows.filter((row) => row.sessionType !== 'Break');

  assert.deepEqual(classRows.map((row) => row.day), ['Monday', 'Monday', 'Tuesday', 'Tuesday', 'Thursday', 'Friday', 'Friday']);
  assert.ok(classRows.find((row) => row.classroom === 'Lab1'));
  assert.ok(classRows.find((row) => row.sessionType === 'Library'));
  assert.equal(rows.filter((row) => row.sessionType === 'Break').length, 4);
});
