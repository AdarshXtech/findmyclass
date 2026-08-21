const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'findmyclass-sections-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(testDirectory, 'test.sqlite');
process.env.DATABASE_URL = process.env.TEST_DATABASE_ADAPTER === 'postgres' ? 'pg-mem://test' : '';

const { initDatabase, execute, queryAll, withTransaction } = require('../config/db');
const migration = require('../migrations/002-normalize-csai-sections');

test.after(() => fs.rmSync(testDirectory, { recursive: true, force: true }));

test('legacy CSAI aliases merge without losing students or timetable rows', async () => {
  await initDatabase();
  for (const [roll, section] of [['1001', '2B'], ['1002', 'CSEAI2B'], ['1003', 'CSAI2B']]) {
    await execute(
      `INSERT INTO students (name, university_roll_number, course, branch, year, section)
       VALUES (?, ?, 'B.Tech', 'CSE AI', 7, ?)`,
      [`Student ${roll}`, roll, section]
    );
  }
  await execute(
    `INSERT INTO timetable_entries
     (section, day_of_week, start_time, end_time, subject_name, session_type, academic_session, semester)
     VALUES ('2B', 1, '09:00', '10:00', 'Data Structures', 'Lecture', '2026-27', 'III')`
  );

  await withTransaction((transaction) => migration.up(transaction));

  assert.deepEqual(await queryAll(
    'SELECT section, branch, year, COUNT(*) AS count FROM students GROUP BY section, branch, year'
  ), [{ section: 'CSAI2B', branch: 'CSAI', year: 2, count: 3 }]);
  assert.equal((await queryAll("SELECT * FROM timetable_entries WHERE section = 'CSAI2B'")).length, 1);
  assert.equal((await queryAll("SELECT * FROM timetable_entries WHERE section IN ('2B', 'CSEAI2B')")).length, 0);
});
