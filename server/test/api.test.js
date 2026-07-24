const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'findmyclass-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(testDirectory, 'test.sqlite');
process.env.DATABASE_URL = process.env.TEST_DATABASE_ADAPTER === 'postgres' ? 'pg-mem://test' : '';
process.env.JWT_SECRET = 'test-only-secret-with-sufficient-length';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.PHONE_LOOKUP_SECRET = 'test-only-phone-lookup-secret';

const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { startServer } = require('../server');
const { initDatabase, execute, queryAll } = require('../config/db');
const csai2bDataset = require('../data/csai2b-2026.json');
const csai2gDataset = require('../data/csai2g-2026.json');
const { normalizeStudentName, hashPhoneNumber } = require('../utils/student-identity');

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

test('CSAI 2G source dataset matches the supplied class timetable', () => {
  assert.equal(csai2gDataset.section, 'CSAI2G');
  assert.equal(csai2gDataset.timetable.length, 28);
  assert.equal(csai2gDataset.timetable.filter((entry) => entry.dayOfWeek === 1).length, 0);
  assert.equal(csai2gDataset.timetable.filter((entry) => entry.sessionType === 'Break').length, 4);
  assert.equal(csai2gDataset.timetable.filter((entry) => entry.sessionType !== 'Break').length, 24);
  const tuesdayLab = csai2gDataset.timetable.find((entry) => entry.subjectCode === 'NCS4352');
  assert.deepEqual(
    { day: tuesdayLab.dayOfWeek, start: tuesdayLab.startTime, end: tuesdayLab.endTime, room: tuesdayLab.room },
    { day: 2, start: '14:00', end: '16:00', room: '516' }
  );
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

function rawApiRequest(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}${urlPath}`, { headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.on('error', reject);
  });
}

test.before(async () => {
  await initDatabase();
  const password = await bcrypt.hash('correct-horse-battery-staple', 4);
  await execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', password]);
  await execute(
    `INSERT INTO students (
       name, normalized_name, phone_lookup_hash, phone_last_four,
       university_roll_number, class_roll_number, course, branch, year, section
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Test Student', 'TEST STUDENT', hashPhoneNumber('7000000001'), '0001', '1250439000', 1, 'B.Tech', 'CSE', 1, 'CSE-A']
  );
  const accessStudents = [
    ['Rudansh Kumar Singh', '7000000101', '1250439358', 'CSAI2B'],
    ['Adarsh Yadav', '7000000102', '1250439029', 'CSAI2G'],
    ['Adarash Tiwari', '7000000103', '1250439028', 'CSAI2B'],
    ['No Schedule Student', '7000000002', '1250439998', 'CSE-Z'],
  ];
  for (const [name, phone, universityRoll, section] of accessStudents) {
    await execute(
      `INSERT INTO students (
         name, normalized_name, phone_lookup_hash, phone_last_four,
         university_roll_number, class_roll_number, course, branch, year, section
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, normalizeStudentName(name), hashPhoneNumber(phone), phone.slice(-4), universityRoll, null, 'B.Tech', 'CSE AI', 2, section]
    );
  }
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
    ['CSAI2B', 1, '09:00', '10:00', 'NCS4302', 'Data Structure using C', 'Lecture', 'Ms. Jyoti Yadav', '407', '2026-27', 'III', 'TEST-2B']
  );
  await execute(
    `INSERT INTO timetable_entries (
       section, day_of_week, start_time, end_time, subject_code, subject_name,
       session_type, faculty_name, room, academic_session, semester, source_label
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['CSAI2G', 2, '09:00', '10:00', 'NCS4302', 'Data Structure using C', 'Lecture', 'Mr. Gaurav Singh', '409', '2026-27', 'III', 'TEST-2G']
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
      [
        'student_id', 'name', 'normalized_name', 'phone_lookup_hash', 'phone_last_four',
        'university_roll_number', 'class_roll_number', 'course', 'branch', 'year', 'section', 'created_at',
      ]
    );

    const invalid = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'Test Student', phone_number: '700000001' },
    });
    assert.equal(invalid.status, 400);

    const missing = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'Test Student', phone_number: '7000000099' },
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Student details not found. Please check your name and phone number.');

    const found = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: '  test   STUDENT ', phone_number: '+91 70000 00001' },
    });
    assert.equal(found.status, 200);
    assert.equal(found.body.data.student.name, 'Test Student');
    assert.equal(found.body.data.student.maskedPhone, '******0001');
    assert.equal(found.body.data.student.universityRollNumber, undefined);
    assert.equal(found.body.data.student.classRollNumber, undefined);
    assert.equal(found.body.data.classrooms[0].room, '305');

    assert.equal(found.body.data.timetable[0].subjectCode, 'NBS4301');
    assert.equal(found.body.data.timetable[0].room, '305');
    assert.equal(found.body.data.timetable[0].classroomNumber, '305');
    assert.equal(found.body.data.timetable[0].classroomPosition, '05');
    assert.equal(found.body.data.timetable[0].floor, 'Floor 3');
    assert.equal(found.body.data.timetable[0].wing, 'A');
    assert.equal(found.body.data.timetable[0].locationDisplay, 'Floor 3 \u00b7 Wing A \u00b7 Classroom 305');
  });

  await t.test('maps verified students to their shared class timetable', async () => {
    const cases = [
      ['Rudansh Kumar Singh', '7000000101', 'CSAI2B', 'Ms. Jyoti Yadav'],
      ['Adarsh Yadav', '70000 00102', 'CSAI2G', 'Mr. Gaurav Singh'],
      ['Adarash Tiwari', '+91 7000000103', 'CSAI2B', 'Ms. Jyoti Yadav'],
    ];

    for (const [name, phone, section, faculty] of cases) {
      const response = await apiRequest('/api/student/lookup', {
        method: 'POST',
        body: { name: name.toUpperCase(), phone_number: phone },
      });
      assert.equal(response.status, 200, name);
      assert.equal(response.body.data.student.section, section, name);
      assert.equal(response.body.data.timetable[0].facultyName, faculty, name);
    }

    const wrongPhone = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'Rudansh Kumar Singh', phone_number: '7000000102' },
    });
    const wrongName = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'Unknown Student', phone_number: '7000000101' },
    });
    assert.equal(wrongPhone.status, 404);
    assert.equal(wrongName.status, 404);
    assert.equal(wrongPhone.body.message, wrongName.body.message);

    const noTimetable = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'No Schedule Student', phone_number: '7000000002' },
    });
    assert.equal(noTimetable.status, 404);
    assert.equal(noTimetable.body.message, 'No timetable is currently available for your assigned class.');
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
    assert.equal(stats.body.data.totalStudents, 5);
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
      body: {
        name: 'Second Student',
        phone_number: '7000000099',
        university_roll_number: '1250439001',
        course: 'B.Tech',
        branch: 'CSE',
        year: 2,
        section: 'cse-b',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.masked_phone_number, '******0099');
    const studentId = created.body.data.student_id;

    const updated = await apiRequest(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      token,
      body: { year: 3, phone_number: '+91 7000000098' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.year, 3);
    assert.equal(updated.body.data.masked_phone_number, '******0098');
    assert.equal(updated.body.data.phone_number, undefined);
    assert.equal(updated.body.data.phone_lookup_hash, undefined);

    const filtered = await apiRequest('/api/admin/students?section=cse-b', { token });
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].year, 3);
    assert.equal(filtered.body.data[0].masked_phone_number, '******0098');

    const invalidPhone = await apiRequest(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      token,
      body: { phone_number: '12345' },
    });
    assert.equal(invalidPhone.status, 400);

    const duplicatePhone = await apiRequest(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      token,
      body: { phone_number: '7000000001' },
    });
    assert.equal(duplicatePhone.status, 409);

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
    assert.equal(rollLookup.status, 400);
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
      body: { section: 'cse-a', subject: 'Physics', room: '210' },
    });
    assert.equal(classroom.status, 201);
    assert.equal(classroom.body.data.floor, 'Floor 2');
    assert.equal(classroom.body.data.wing, 'B');
    const classroomId = classroom.body.data.classroom_id;

    const invalidClassroom = await apiRequest('/api/admin/classrooms', {
      method: 'POST',
      token,
      body: { section: 'cse-a', subject: 'Invalid Room', room: '901' },
    });
    assert.equal(invalidClassroom.status, 400);
    assert.equal(
      invalidClassroom.body.message,
      'Invalid classroom number. Use UGF, LGF, or floors 1 to 8, with a room position between 01 and 21.'
    );

    const filtered = await apiRequest('/api/admin/classrooms?section=cse-a', { token });
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.length, 2);

    const updated = await apiRequest(`/api/admin/classrooms/${classroomId}`, {
      method: 'PUT',
      token,
      body: { room: '211' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.room, '211');

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

  await t.test('batches large imports and negotiates compressed JSON responses', async (t) => {
    const rows = ['Name,University Roll Number,Class Roll Number,Course,Branch,Year,Section'];
    for (let index = 0; index < 250; index++) {
      rows.push(`Bulk Student ${index},77${String(index).padStart(8, '0')},${index + 1},B.Tech,CSE,2,CSE-B`);
    }
    const form = new FormData();
    form.append('file', new Blob([rows.join('\n')], { type: 'text/csv' }), 'bulk-students.csv');

    const startedAt = performance.now();
    const imported = await apiRequest('/api/admin/import/students', {
      method: 'POST',
      token,
      body: form,
    });
    const durationMs = performance.now() - startedAt;
    assert.equal(imported.status, 200);
    assert.equal(imported.body.data.imported, 250);
    assert.equal(imported.body.data.skipped, 0);
    assert.ok(durationMs < 2000, `Bulk import took ${durationMs.toFixed(1)}ms`);
    t.diagnostic(`250-row import completed in ${durationMs.toFixed(1)}ms`);

    const authorization = { Authorization: `Bearer ${token}` };
    const identity = await rawApiRequest('/api/admin/students', {
      ...authorization,
      'Accept-Encoding': 'identity',
    });
    const compressed = await rawApiRequest('/api/admin/students', {
      ...authorization,
      'Accept-Encoding': 'gzip',
    });

    assert.equal(identity.status, 200);
    assert.equal(identity.headers['content-encoding'], undefined);
    assert.equal(compressed.status, 200);
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.ok(compressed.body.length < identity.body.length * 0.35);
    t.diagnostic(
      `gzip reduced ${identity.body.length} bytes to ${compressed.body.length} bytes ` +
      `(${((1 - compressed.body.length / identity.body.length) * 100).toFixed(1)}% smaller)`
    );
    const parsed = JSON.parse(zlib.gunzipSync(compressed.body).toString('utf8'));
    assert.equal(parsed.success, true);
    assert.ok(parsed.data.length >= 250);
  });

  await t.test('temporarily rate limits repeated failed identity matches', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await apiRequest('/api/student/lookup', {
        method: 'POST',
        body: { name: 'Unknown Student', phone_number: `800000000${attempt}` },
      });
      assert.equal(response.status, 404);
    }

    const blocked = await apiRequest('/api/student/lookup', {
      method: 'POST',
      body: { name: 'Test Student', phone_number: '7000000001' },
    });
    assert.equal(blocked.status, 429);
  });

  await t.test('temporarily rate limits repeated failed admin logins', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: { username: 'admin', password: `wrong-password-${attempt}` },
      });
      assert.equal(response.status, 401);
    }

    const blocked = await apiRequest('/api/admin/login', {
      method: 'POST',
      body: { username: 'admin', password: 'correct-horse-battery-staple' },
    });
    assert.equal(blocked.status, 429);
  });
});
