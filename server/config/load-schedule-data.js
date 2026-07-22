const { loadEnvironment } = require('./env');

loadEnvironment();

const csai2b = require('../data/csai2b-2026.json');
const csai2g = require('../data/csai2g-2026.json');
const { initDatabase, queryAll, withTransaction } = require('./db');
const {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
} = require('../utils/student-identity');

const datasets = [csai2b, csai2g];

function readAccessRecords() {
  const raw = String(process.env.STUDENT_ACCESS_RECORDS_JSON || '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STUDENT_ACCESS_RECORDS_JSON is required in production.');
    }
    return [];
  }
  if (!process.env.PHONE_LOOKUP_SECRET) {
    throw new Error('PHONE_LOOKUP_SECRET is required when student access records are configured.');
  }

  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('STUDENT_ACCESS_RECORDS_JSON must contain an array.');
  return records;
}

async function loadScheduleData({ accessRecords = readAccessRecords() } = {}) {
  await initDatabase();

  const roster = csai2b.students;
  const rollPlaceholders = roster.map(() => '?').join(', ');
  const existingStudents = await queryAll(
    `SELECT university_roll_number FROM students WHERE university_roll_number IN (${rollPlaceholders})`,
    roster.map((student) => student.universityRollNumber)
  );
  const existingRolls = new Set(existingStudents.map((student) => student.university_roll_number));
  const studentsCreated = roster.filter((student) => !existingRolls.has(student.universityRollNumber)).length;

  await withTransaction(async (transaction) => {
    await transaction.insertMany(
      'students',
      ['name', 'normalized_name', 'university_roll_number', 'class_roll_number', 'course', 'branch', 'year', 'section'],
      roster.map((student) => [
        student.name,
        normalizeStudentName(student.name),
        student.universityRollNumber,
        student.classRollNumber,
        csai2b.course,
        csai2b.branch,
        csai2b.year,
        csai2b.section,
      ]),
      {
        suffix: `ON CONFLICT (university_roll_number) DO UPDATE SET
          name = excluded.name,
          normalized_name = excluded.normalized_name,
          class_roll_number = excluded.class_roll_number,
          course = excluded.course,
          branch = excluded.branch,
          year = excluded.year,
          section = excluded.section`,
      }
    );

    const allSubjects = new Map();
    for (const dataset of datasets) {
      for (const subject of dataset.subjects) allSubjects.set(subject.name, subject);
    }
    await transaction.insertMany(
      'subjects',
      ['subject_name'],
      [...allSubjects.values()].map((subject) => [subject.name]),
      { suffix: 'ON CONFLICT (subject_name) DO NOTHING' }
    );

    for (const dataset of datasets) {
      await transaction.execute(
        'DELETE FROM timetable_entries WHERE section = ? AND academic_session = ?',
        [dataset.section, dataset.academicSession]
      );
      await transaction.insertMany(
        'timetable_entries',
        [
          'section', 'day_of_week', 'start_time', 'end_time', 'subject_code', 'subject_name',
          'session_type', 'faculty_code', 'faculty_name', 'room', 'academic_session',
          'semester', 'source_label',
        ],
        dataset.timetable.map((entry) => [
          dataset.section,
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          entry.subjectCode,
          entry.subjectName,
          entry.sessionType,
          entry.facultyCode,
          entry.facultyName,
          entry.room,
          dataset.academicSession,
          dataset.semester,
          dataset.sourceSectionLabels.timetable,
        ])
      );
    }

    for (const record of accessRecords) {
      const phoneNumber = normalizePhoneNumber(record.phoneNumber);
      const normalizedName = normalizeStudentName(record.name);
      const dataset = datasets.find((entry) => entry.section === record.section);
      if (!phoneNumber || !normalizedName || !dataset || !record.universityRollNumber) {
        throw new Error('Student access records must include a valid name, phone number, university roll number, and class.');
      }

      const result = await transaction.execute(
        `UPDATE students
         SET name=?, normalized_name=?, phone_lookup_hash=?, phone_last_four=?,
             course=?, branch=?, year=?, section=?
         WHERE university_roll_number=?`,
        [
          String(record.name).trim().replace(/\s+/g, ' '),
          normalizedName,
          hashPhoneNumber(phoneNumber),
          phoneNumber.slice(-4),
          dataset.course,
          dataset.branch,
          dataset.year,
          dataset.section,
          record.universityRollNumber,
        ]
      );
      if (result.changes !== 1) throw new Error('A configured student access record was not found in the roster.');
    }
  });

  console.log(
    `Loaded ${datasets.map((dataset) => dataset.displayName).join(' and ')}: ` +
    `${studentsCreated} students created, ${roster.length - studentsCreated} updated, ` +
    `${datasets.reduce((total, dataset) => total + dataset.timetable.length, 0)} timetable entries.`
  );
}

if (require.main === module) {
  loadScheduleData().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { datasets, loadScheduleData, readAccessRecords };
