const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'findmyclass-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(testDirectory, 'test.sqlite');
process.env.DATABASE_URL = process.env.TEST_DATABASE_ADAPTER === 'postgres' ? 'pg-mem://test' : '';
process.env.JWT_SECRET = 'test-only-secret-with-sufficient-length';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { startServer } = require('../server');
const { initDatabase, execute, queryAll } = require('../config/db');
const csai2bDataset = require('../data/csai2b-2026.json');

let server;
let baseUrl;
let token;

test('CSAI 2B source dataset contains only the confirmed class roster and timetable', () => {
  assert.equal(csai2bDataset.section, 'CSAI2B');
  assert.equal(csai2bDataset.students.length, 58);
  assert.equal(csai2bDataset.timetable.length, 29);
  assert.equal(csai2bDataset.timetable.filter((entry) => entry.sessionType === 'Break').length, 5);
  assert.equal(csai2bDataset.timetable.filter((entry) => entry.sessionType !== 'Break').length, 24);
  assert.equal(new Set(csai2bDataset.students.map((student) => student.universityRollNumber)).size, 58);
  assert.deepEqual(
    csai2bDataset.students.find((student) => student.universityRollNumber === '1250439358'),
    { classRollNumber: 41, universityRollNumber: '1250439358', name: 'RUDRANSH KUMAR SINGH' }
  );
  assert.equal(csai2bDataset.students.some((student) => student.name === 'PRATIK SINGH'), false);
});

async function apiRequest(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: options.method || 'GET',
    headers,
    body,
  });
  const responseBody = await response.json();
  return { status: response.status, body: responseBody };
}

test.before(async () => {
  await initDatabase();
  const password = await bcrypt.hash('correct-horse-battery-staple', 4);
  await execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', password]);
  await execute(
    `INSERT INTO students (
       name, university_roll_number, class_roll_number, course, branch, year, section
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Test Student', '1250439000', 1, 'B.Tech', 'CSE', 1, 'CSE-A']
  );
  await execute('INSERT INTO subjects (subject_name) VALUES (?)', ['Mathematics']);
  await execute(
    'INSERT INTO classrooms (section, subject, floor, wing, room) VALUES (?, ?, ?, ?, ?)',
    ['CSE-A', 'Mathematics', '3rd Floor', 'B', '305']
  );
  await execute(
    `INSERT INTO timetable_entries (
       section, day_of_week, start_time, end_time, subject_code, subject_name,
       session_type, faculty_name, room, academic_session, semester, source_label
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['CSE-A', 1, '09:00', '10:00', 'NBS4301', 'Mathematics', 'Lecture', 'Test Faculty', '305', '2026-27', 'III', 'TEST']
  );

  server = await startServer(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('health, lookup, authentication, CRUD, and import workflows', async (t) => {
  await t.test('reports health and a JSON 404', async () => {
    const health = await apiRequest('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const missing = await apiRequest('/api/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
  });

  await t.test('validates and completes student lookup', async () => {
    const schemaQuery = process.env.DATABASE_URL
      ? `SELECT column_name AS name
         FROM information_schema.columns
         WHERE table_name = 'students'
         ORDER BY ordinal_position`
      : 'PRAGMA table_info(students)';
    assert.deepEqual(
      (await queryAll(schemaQuery)).map((column) => column.name),
      ['student_id', 'name', 'university_roll_number', 'class_roll_number', 'course', 'branch', 'year', 'section', 'created_at']
    );

    const invalid = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { university_roll_number: '123' },
    });
    assert.equal(invalid.status, 400);

    const missing = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { university_roll_number: '9999999999' },
    });
    assert.equal(missing.status, 404);

    const found = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { university_roll_number: '1250439000' },
    });
    assert.equal(found.status, 200);
    assert.equal(found.body.data.student.name, 'Test Student');
    assert.equal(found.body.data.classrooms[0].room, '305');

    assert.equal(found.body.data.student.classRollNumber, 1);
    assert.equal(found.body.data.timetable[0].subjectCode, 'NBS4301');
    assert.equal(found.body.data.timetable[0].room, '305');
  });

  await t.test('rejects invalid credentials and protects admin endpoints', async () => {
    const unauthenticated = await apiRequest('/api/admin/stats');
    assert.equal(unauthenticated.status, 401);

    const invalid = await apiRequest('/api/admin/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrong-password' },
    });
    assert.equal(invalid.status, 401);

    const login = await apiRequest('/api/admin/login', {
      method: 'POST',
      body: { username: 'admin', password: 'correct-horse-battery-staple' },
    });
    assert.equal(login.status, 200);
    token = login.body.data.token;
    assert.ok(token);

    const stats = await apiRequest('/api/admin/stats', { token });
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.totalStudents, 1);
  });

  await t.test('persists student create, update, filter, and delete operations', async () => {
    const whitespace = await apiRequest('/api/admin/students', {
      method: 'POST',
      token,
      body: { name: '   ', university_roll_number: '1250439001', course: 'B.Tech', branch: 'CSE', year: 1, section: 'CSE-B' },
    });
    assert.equal(whitespace.status, 400);

    const created = await apiRequest('/api/admin/students', {
      method: 'POST',
      token,
      body: { name: 'Second Student', university_roll_number: '1250439001', course: 'B.Tech', branch: 'CSE', year: 2, section: 'cse-b' },
    });
    assert.equal(created.status, 201);
    const studentId = created.body.data.student_id;

    const updated = await apiRequest(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      token,
      body: { year: 3 },
    });
    assert.equal(updated.status, 200);

    const filtered = await apiRequest('/api/admin/students?section=cse-b', { token });
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].year, 3);

    const removed = await apiRequest(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
      token,
    });
    assert.equal(removed.status, 200);

    const rollOnly = await apiRequest('/api/admin/students', {
      method: 'POST',
      token,
      body: {
        name: 'Roll Only Student',
        university_roll_number: '1250439999',
        class_roll_number: 59,
        course: 'B.Tech',
        branch: 'CSAI',
        year: 2,
        section: 'CSAI2B',
      },
    });
    assert.equal(rollOnly.status, 201);
    assert.equal(rollOnly.body.data.university_roll_number, '1250439999');

    const rollLookup = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { university_roll_number: '1250439999' },
    });
    assert.equal(rollLookup.status, 200);
    assert.equal(rollLookup.body.data.student.name, 'Roll Only Student');
  });

  await t.test('persists subject and classroom CRUD operations', async () => {
    const subject = await apiRequest('/api/admin/subjects', {
      method: 'POST',
      token,
      body: { subject_name: 'Physics' },
    });
    assert.equal(subject.status, 201);

    const classroom = await apiRequest('/api/admin/classrooms', {
      method: 'POST',
      token,
      body: { section: 'cse-a', subject: 'Physics', floor: '2nd Floor', wing: 'a', room: '210' },
    });
    assert.equal(classroom.status, 201);
    const classroomId = classroom.body.data.classroom_id;

    const filtered = await apiRequest('/api/admin/classrooms?section=cse-a', { token });
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.length, 2);

    const updated = await apiRequest(`/api/admin/classrooms/${classroomId}`, {
      method: 'PUT',
      token,
      body: { room: '211' },
    });
    assert.equal(updated.status, 200);

    const removed = await apiRequest(`/api/admin/classrooms/${classroomId}`, {
      method: 'DELETE',
      token,
    });
    assert.equal(removed.status, 200);

    const subjectRemoved = await apiRequest(`/api/admin/subjects/${subject.body.data.subject_id}`, {
      method: 'DELETE',
      token,
    });
    assert.equal(subjectRemoved.status, 200);
  });

  await t.test('imports CSV and reports every skipped row', async () => {
    const csv = [
      'Name,University Roll Number,Class Roll Number,Course,Branch,Year,Section',
      'CSV Student,1250439002,2,B.Tech,CSE,1,CSE-A',
      'Duplicate Student,1250439000,3,B.Tech,CSE,1,CSE-A',
    ].join('\n');
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'students.csv');

    const result = await apiRequest('/api/admin/import/students', {
      method: 'POST',
      token,
      body: form,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.imported, 1);
    assert.equal(result.body.data.skipped, 1);
    assert.match(result.body.data.errors[0], /already registered/);
  });

  await t.test('imports XLSX and rejects unsupported or malformed files', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students');
    worksheet.addRow(['Name', 'University Roll Number', 'Class Roll Number', 'Course', 'Branch', 'Year', 'Section']);
    worksheet.addRow(['XLSX Student', '1250439003', 4, 'B.Tech', 'ECE', 1, 'ECE-A']);
    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    const xlsxForm = new FormData();
    xlsxForm.append('file', new Blob([xlsxBuffer]), 'students.xlsx');

    const imported = await apiRequest('/api/admin/import/students', {
      method: 'POST',
      token,
      body: xlsxForm,
    });
    assert.equal(imported.status, 200);
    assert.equal(imported.body.data.imported, 1);

    const unsupportedForm = new FormData();
    unsupportedForm.append('file', new Blob(['legacy']), 'students.xls');
    const unsupported = await apiRequest('/api/admin/import/students', {
      method: 'POST',
      token,
      body: unsupportedForm,
    });
    assert.equal(unsupported.status, 400);

    const malformedForm = new FormData();
    malformedForm.append('file', new Blob(['not a workbook']), 'students.xlsx');
    const malformed = await apiRequest('/api/admin/import/students', {
      method: 'POST',
      token,
      body: malformedForm,
    });
    assert.equal(malformed.status, 400);
  });
});
