const express = require('express');
const router = express.Router();
const { parseClassroomLocation } = require('../utils/classroom-location');
const studentRepository = require('../repositories/student-repository');
const timetableRepository = require('../repositories/timetable-repository');
const classroomRepository = require('../repositories/classroom-repository');
const logger = require('../utils/logger');
const {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
  hashStudentLookupIdentity,
} = require('../utils/student-identity');
const { createFailedAttemptLimiter } = require('../middleware/rate-limit');
const { facultyForStudent } = require('../services/faculty-service');

const LOOKUP_ERROR = 'Student details not found. Please check your name and phone number.';
const TEST_LOGIN = Object.freeze({
  name: 'TEST',
  phoneNumber: '1234567890',
  section: 'CSAI2B',
});
const studentLookupLimiter = createFailedAttemptLimiter({
  windowMs: Number(process.env.STUDENT_LOOKUP_WINDOW_MS) || 15 * 60 * 1000,
  maxAttempts: Number(process.env.STUDENT_LOOKUP_MAX_FAILURES) || 8,
  message: 'Too many unsuccessful attempts for these details. Please wait and try again.',
  keyFor: (req) => req.studentLookupKey || 'invalid-student-identity',
});

/** POST /api/student/lookup - verify a student and return their class schedule. */
router.post('/lookup', async (req, res) => {
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
    req.studentLookupKey = hashStudentLookupIdentity(normalizedName, phoneNumber);
    if (studentLookupLimiter.check(req, res)) return;

    const isTestLogin = process.env.ENABLE_TEST_LOGIN === 'true'
      && normalizedName === TEST_LOGIN.name
      && phoneNumber === TEST_LOGIN.phoneNumber;
    const matches = isTestLogin
      ? [{
          student_id: 'test',
          name: 'Test',
          phone_last_four: TEST_LOGIN.phoneNumber.slice(-4),
          course: 'B.Tech',
          branch: 'CSAI',
          year: 2,
          section: TEST_LOGIN.section,
        }]
      : await studentRepository.findByIdentity(normalizedName, phoneHash);

    if (matches.length !== 1) {
      studentLookupLimiter.recordFailure(req);
      return res.status(404).json({ success: false, message: LOOKUP_ERROR });
    }

    const student = matches[0];
    studentLookupLimiter.clear(req);

    const [classrooms, timetable, facultyContacts] = await Promise.all([
      classroomRepository.findBySection(student.section),
      timetableRepository.findBySection(student.section),
      facultyForStudent(student.section),
    ]);

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
        facultyContacts,
        timetable: timetable.map((entry) => {
          const classroom = classroomBySubject.get(String(entry.subject_name || '').trim().toLowerCase());
          const room = entry.room || classroom?.room || null;
          const location = parseClassroomLocation(room, {
            subjectName: entry.subject_name,
            sessionType: entry.session_type,
          });
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
            floor: location.floorLabel,
            floorCode: location.floorCode,
            floorLabel: location.floorLabel,
            shortFloor: location.shortFloor,
            wing: location.wing,
            classroomNumber: location.classroomNumber,
            classroomPosition: location.roomPosition,
            originalClassroom: location.originalClassroom || null,
            room,
            locationName: location.locationName,
            fullLocationName: location.fullLocationName,
            subLocations: location.subLocations,
            isSpecialLocation: location.isSpecialLocation,
            locationDisplay: location.displayLabel,
            shortLocationDisplay: location.shortLabel,
            locationError: location.error,
            academicSession: entry.academic_session,
            semester: entry.semester,
          };
        }),
      },
    });
  } catch (error) {
    logger.error('Student lookup failed', { requestId: req.requestId, error: error.message });
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
});

module.exports = router;
