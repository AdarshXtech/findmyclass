const { loadEnvironment } = require('./env');

loadEnvironment();

const dataset = require('../data/csai2b-2026.json');
const { initDatabase, queryOne, execute } = require('./db');

async function loadCsai2b() {
  await initDatabase();

  let studentsCreated = 0;
  let studentsUpdated = 0;
  for (const student of dataset.students) {
    const existing = await queryOne(
      'SELECT student_id FROM students WHERE university_roll_number = ?',
      [student.universityRollNumber]
    );
    const values = [
      student.name,
      student.universityRollNumber,
      student.classRollNumber,
      dataset.course,
      dataset.branch,
      dataset.year,
      dataset.section,
    ];

    if (existing) {
      await execute(
        `UPDATE students
         SET name=?, university_roll_number=?, class_roll_number=?, course=?, branch=?, year=?, section=?
         WHERE student_id=?`,
        [...values, existing.student_id]
      );
      studentsUpdated++;
    } else {
      await execute(
        `INSERT INTO students (
           name, university_roll_number, class_roll_number, course, branch, year, section
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values
      );
      studentsCreated++;
    }
  }

  for (const subject of dataset.subjects) {
    const existing = await queryOne('SELECT subject_id FROM subjects WHERE subject_name = ?', [subject.name]);
    if (!existing) await execute('INSERT INTO subjects (subject_name) VALUES (?)', [subject.name]);
  }

  await execute(
    'DELETE FROM timetable_entries WHERE section = ? AND academic_session = ?',
    [dataset.section, dataset.academicSession]
  );
  for (const entry of dataset.timetable) {
    await execute(
      `INSERT INTO timetable_entries (
         section, day_of_week, start_time, end_time, subject_code, subject_name,
         session_type, faculty_code, faculty_name, room, academic_session,
         semester, source_label
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );
  }

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
