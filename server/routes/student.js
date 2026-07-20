const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../config/db');
const { normalizePhone, isValidPhone } = require('../utils/validation');

/**
 * POST /api/student/lookup
 * Lookup a student by phone number and return their profile + classroom details.
 */
router.post('/lookup', (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.'
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number.'
      });
    }

    // Find student by phone number
    const student = queryOne(
      'SELECT student_id, name, phone, course, branch, year, section FROM students WHERE phone = ?',
      [cleanPhone]
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No student found. Please enter your registered phone number.'
      });
    }

    // Get all classroom assignments for the student's section
    const classrooms = queryAll(
      'SELECT classroom_id, section, subject, floor, wing, room FROM classrooms WHERE section = ? ORDER BY subject',
      [student.section]
    );

    res.json({
      success: true,
      data: {
        student: {
          id: student.student_id,
          name: student.name,
          phone: student.phone,
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
