const express = require('express');
const router = express.Router();
const { queryAll } = require('../config/db');
const { parseClassroomLocation } = require('../utils/classroom-location');
const {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
} = require('../utils/student-identity');
const { createFailedAttemptLimiter } = require('../middleware/rate-limit');

const LOOKUP_ERROR = 'Student details not found. Please check your name and phone number.';
const lookupLimiter = createFailedAttemptLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  message: 'Too many unsuccessful attempts. Please wait 15 minutes and try again.',
});

/** POST /api/student/lookup - verify a student and return their class schedule. */
router.post('/lookup', async (req, res) => {
  if (lookupLimiter.check(req, res)) return;

  try {
    const normalizedName = normalizeStudentName(req.body.name);
    const phoneNumber = normalizePhoneNumber(req.body.phone_number ?? req.body.phoneNumber);

    if (!normalizedName || !String(req.body.phone_number ?? req.body.phoneNumber ?? '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Student name and phone number are required.',
      });
    }
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit phone number.',
      });
    }

    const phoneHash = hashPhoneNumber(phoneNumber);
    if (!phoneHash) throw new Error('PHONE_LOOKUP_SECRET is not configured.');

    const matches = await queryAll(
      `SELECT student_id, name, phone_last_four, course, branch, year, section
       FROM students
       WHERE normalized_name = ? AND phone_lookup_hash = ?`,
      [normalizedName, phoneHash]
    );

    if (matches.length !== 1) {
      lookupLimiter.recordFailure(req);
      return res.status(404).json({ success: false, message: LOOKUP_ERROR });
    }

    const student = matches[0];
    lookupLimiter.clear(req);

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

    if (timetable.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No timetable is currently available for your assigned class.',
      });
    }

    const classroomBySubject = new Map(
      classrooms.map((classroom) => [String(classroom.subject).trim().toLowerCase(), classroom])
    );

    res.json({
      success: true,
      data: {
        student: {
          id: student.student_id,
          name: student.name,
          maskedPhone: student.phone_last_four ? `******${student.phone_last_four}` : null,
          course: student.course,
          branch: student.branch,
          year: student.year,
          section: student.section,
        },
        classrooms: classrooms.map((classroom) => ({
          id: classroom.classroom_id,
          subject: classroom.subject,
          floor: classroom.floor,
          wing: classroom.wing,
          room: classroom.room,
        })),
        timetable: timetable.map((entry) => {
          const classroom = classroomBySubject.get(String(entry.subject_name || '').trim().toLowerCase());
          const room = entry.room || classroom?.room || null;
          const location = parseClassroomLocation(room);
          return {
            id: entry.timetable_entry_id,
            dayOfWeek: entry.day_of_week,
            startTime: entry.start_time,
            endTime: entry.end_time,
            subjectCode: entry.subject_code,
            subjectName: entry.subject_name,
            sessionType: entry.session_type,
            facultyCode: entry.faculty_code,
            facultyName: entry.faculty_name,
            floor: location.floor,
            floorCode: location.floorCode,
            shortFloor: location.shortFloor,
            wing: location.wing,
            classroomNumber: location.classroomNumber,
            classroomPosition: location.roomPosition,
            originalClassroom: location.originalClassroom || null,
            room,
            locationDisplay: location.fullDisplay,
            shortLocationDisplay: location.shortDisplay,
            locationError: location.error,
            academicSession: entry.academic_session,
            semester: entry.semester,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Student lookup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
});

module.exports = router;
