const express = require('express');
const router = express.Router();
const { queryAll } = require('../config/db');
const { normalizeUniversityRollNumber, isValidUniversityRollNumber } = require('../utils/validation');

/**
 * POST /api/student/lookup
 * Lookup a student by university roll number and return their schedule.
 */
router.post('/lookup', async (req, res) => {
  try {
    const suppliedRollNumber = req.body.university_roll_number ?? req.body.identifier;

    if (!suppliedRollNumber) {
      return res.status(400).json({
        success: false,
        message: 'University roll number is required.'
      });
    }

    const universityRollNumber = normalizeUniversityRollNumber(suppliedRollNumber);
    if (!isValidUniversityRollNumber(universityRollNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid university roll number.'
      });
    }

    const matches = await queryAll(
      `SELECT student_id, name, university_roll_number, class_roll_number,
              course, branch, year, section
       FROM students
       WHERE university_roll_number = ?`,
      [universityRollNumber]
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No student found for that university roll number.'
      });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        success: false,
        message: 'That university roll number matches more than one student. Please contact an administrator.'
      });
    }

    const student = matches[0];

    // Get all classroom assignments for the student's section
    const classrooms = await queryAll(
      'SELECT classroom_id, section, subject, floor, wing, room FROM classrooms WHERE section = ? ORDER BY subject',
      [student.section]
    );

    const timetable = await queryAll(
      `SELECT timetable_entry_id, day_of_week, start_time, end_time,
              subject_code, subject_name, session_type, faculty_code,
              faculty_name, room, academic_session, semester
       FROM timetable_entries
       WHERE section = ?
       ORDER BY day_of_week, start_time`,
      [student.section]
    );

    res.json({
      success: true,
      data: {
        student: {
          id: student.student_id,
          name: student.name,
          universityRollNumber: student.university_roll_number,
          classRollNumber: student.class_roll_number,
          course: student.course,
          branch: student.branch,
          year: student.year,
          section: student.section
        },
        classrooms: classrooms.map(c => ({
          id: c.classroom_id,
          subject: c.subject,
          floor: c.floor,
          wing: c.wing,
          room: c.room
        })),
        timetable: timetable.map((entry) => ({
          id: entry.timetable_entry_id,
          dayOfWeek: entry.day_of_week,
          startTime: entry.start_time,
          endTime: entry.end_time,
          subjectCode: entry.subject_code,
          subjectName: entry.subject_name,
          sessionType: entry.session_type,
          facultyCode: entry.faculty_code,
          facultyName: entry.faculty_name,
          room: entry.room,
          academicSession: entry.academic_session,
          semester: entry.semester
        }))
      }
    });
  } catch (error) {
    console.error('Student lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
  }
});

module.exports = router;
