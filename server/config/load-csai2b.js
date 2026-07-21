const { loadEnvironment } = require('./env');

loadEnvironment();

const dataset = require('../data/csai2b-2026.json');
const { initDatabase, queryAll, withTransaction } = require('./db');

async function loadCsai2b() {
  await initDatabase();

  const rollPlaceholders = dataset.students.map(() => '?').join(', ');
  const existingStudents = await queryAll(
    `SELECT university_roll_number FROM students WHERE university_roll_number IN (${rollPlaceholders})`,
    dataset.students.map((student) => student.universityRollNumber)
  );
  const existingRolls = new Set(existingStudents.map((student) => student.university_roll_number));
  const studentsCreated = dataset.students.filter((student) => !existingRolls.has(student.universityRollNumber)).length;
  const studentsUpdated = dataset.students.length - studentsCreated;
  const studentRows = dataset.students.map((student) => [
      student.name,
      student.universityRollNumber,
      student.classRollNumber,
      dataset.course,
      dataset.branch,
      dataset.year,
      dataset.section,
  ]);
  const timetableRows = dataset.timetable.map((entry) => [
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
  ]);

  await withTransaction(async (transaction) => {
    await transaction.insertMany(
      'students',
      ['name', 'university_roll_number', 'class_roll_number', 'course', 'branch', 'year', 'section'],
      studentRows,
      {
        suffix: `ON CONFLICT (university_roll_number) DO UPDATE SET
          name = excluded.name,
          class_roll_number = excluded.class_roll_number,
          course = excluded.course,
          branch = excluded.branch,
          year = excluded.year,
          section = excluded.section`,
      }
    );
    await transaction.insertMany(
      'subjects',
      ['subject_name'],
      dataset.subjects.map((subject) => [subject.name]),
      { suffix: 'ON CONFLICT (subject_name) DO NOTHING' }
    );
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
      timetableRows
    );
  });

  console.log(
    `Loaded ${dataset.displayName}: ${studentsCreated} students created, ` +
    `${studentsUpdated} updated, ${dataset.timetable.length} timetable entries.`
  );
}

if (require.main === module) {
  loadCsai2b().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { loadCsai2b };
