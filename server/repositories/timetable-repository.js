const { queryAll } = require('../config/db');

function findBySection(section) {
  return queryAll(
    `SELECT timetable_entry_id, day_of_week, start_time, end_time,
            subject_code, subject_name, session_type, faculty_code,
            faculty_name, room, academic_session, semester
     FROM timetable_entries WHERE section = ? ORDER BY day_of_week, start_time`,
    [section]
  );
}

module.exports = { findBySection };
