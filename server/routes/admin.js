const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('@e965/xlsx');
const { queryAll, queryOne, execute, withTransaction } = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const {
  normalizeUniversityRollNumber,
  isValidUniversityRollNumber,
  normalizeClassRollNumber,
  isValidClassRollNumber,
  normalizeSection,
  isValidSection,
  normalizeYear,
  isValidYear,
} = require('../utils/validation');
const {
  CLASSROOM_ERROR,
  getClassroomLocationOptions,
  parseClassroomLocation,
} = require('../utils/classroom-location');
const {
  normalizeStudentName,
  normalizePhoneNumber,
  hashPhoneNumber,
  maskPhoneNumber,
} = require('../utils/student-identity');
const {
  DAYS,
  formatEntry,
  parseTimetableText,
  shiftRows,
  validateRows,
} = require('../utils/timetable-manager');
const { extractTimetableImage } = require('../utils/timetable-ocr');
const { createFailedAttemptLimiter } = require('../middleware/rate-limit');

const adminLoginLimiter = createFailedAttemptLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  message: 'Too many unsuccessful login attempts. Please wait 15 minutes and try again.',
});

function formatStudentForAdmin(student) {
  const { phone_last_four: phoneLastFour, phone_lookup_hash: _phoneHash, ...safeStudent } = student;
  return {
    ...safeStudent,
    masked_phone_number: phoneLastFour ? maskPhoneNumber(phoneLastFour) : null,
  };
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  if (adminLoginLimiter.check(req, res)) return;

  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    const admin = await queryOne('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) {
      adminLoginLimiter.recordFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      adminLoginLimiter.recordFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    adminLoginLimiter.clear(req);
    const token = jwt.sign(
      { id: admin.admin_id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: admin.admin_id, username: admin.username }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ════════════════════════════════════════════════════════════

/** GET /api/admin/stats */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalStudents   = Number((await queryOne('SELECT COUNT(*) as count FROM students')).count);
    const totalSubjects   = Number((await queryOne('SELECT COUNT(*) as count FROM subjects')).count);
    const totalClassrooms = Number((await queryOne('SELECT COUNT(*) as count FROM classrooms')).count);
    const totalSections   = Number((await queryOne('SELECT COUNT(DISTINCT section) as count FROM students')).count);

    const sectionWise = await queryAll(
      'SELECT section, COUNT(*) as count FROM students GROUP BY section ORDER BY section'
    );

    res.json({
      success: true,
      data: {
        totalStudents,
        totalSubjects,
        totalClassrooms,
        totalSections,
        sectionWise: sectionWise.map((row) => ({ ...row, count: Number(row.count) }))
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  STUDENTS CRUD
// ════════════════════════════════════════════════════════════

/** GET /api/admin/students */
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const { search, section } = req.query;

    let query = `SELECT student_id, name, phone_last_four, university_roll_number, class_roll_number,
                        course, branch, year, section, created_at
                 FROM students WHERE 1=1`;
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR university_roll_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (section) {
      const normalizedSection = normalizeSection(section);
      query += ' AND section = ?';
      params.push(normalizedSection);
    }

    query += ' ORDER BY name';
    const students = await queryAll(query, params);
    res.json({ success: true, data: students.map(formatStudentForAdmin) });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/students */
router.post('/students', authenticateToken, async (req, res) => {
  try {
    const { name, phone_number, university_roll_number, class_roll_number, course, branch, year, section } = req.body;
    const cleanedName = String(name || '').trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeStudentName(cleanedName);
    const cleanedUniversityRoll = university_roll_number
      ? normalizeUniversityRollNumber(university_roll_number)
      : null;
    const parsedClassRoll = normalizeClassRollNumber(class_roll_number);
    const cleanedCourse = String(course || '').trim();
    const cleanedBranch = String(branch || '').trim();
    const cleanedSection = normalizeSection(section);
    const parsedYear = normalizeYear(year);
    const hasPhoneNumber = String(phone_number || '').trim().length > 0;
    const cleanedPhoneNumber = hasPhoneNumber ? normalizePhoneNumber(phone_number) : null;

    if (!cleanedName || !cleanedUniversityRoll || !cleanedCourse || !cleanedBranch || !parsedYear || !cleanedSection) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidUniversityRollNumber(cleanedUniversityRoll)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid university roll number.' });
    }
    if (!isValidClassRollNumber(parsedClassRoll)) {
      return res.status(400).json({ success: false, message: 'Class roll number must be between 1 and 999.' });
    }
    if (!isValidYear(parsedYear)) {
      return res.status(400).json({ success: false, message: 'Year must be between 1 and 8.' });
    }
    if (!isValidSection(cleanedSection)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }
    if (hasPhoneNumber && !cleanedPhoneNumber) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number.' });
    }

    const phoneHash = cleanedPhoneNumber ? hashPhoneNumber(cleanedPhoneNumber) : null;
    if (cleanedPhoneNumber && !phoneHash) {
      throw new Error('PHONE_LOOKUP_SECRET is not configured.');
    }

    const existingUniversityRoll = await queryOne(
      'SELECT student_id FROM students WHERE university_roll_number = ?',
      [cleanedUniversityRoll]
    );
    if (existingUniversityRoll) {
      return res.status(409).json({ success: false, message: 'University roll number already registered.' });
    }
    if (phoneHash) {
      const existingPhone = await queryOne('SELECT student_id FROM students WHERE phone_lookup_hash = ?', [phoneHash]);
      if (existingPhone) {
        return res.status(409).json({ success: false, message: 'Phone number already registered.' });
      }
    }

    const result = await execute(
      `INSERT INTO students (
         name, normalized_name, phone_lookup_hash, phone_last_four,
         university_roll_number, class_roll_number, course, branch, year, section
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanedName,
        normalizedName,
        phoneHash,
        cleanedPhoneNumber ? cleanedPhoneNumber.slice(-4) : null,
        cleanedUniversityRoll,
        parsedClassRoll,
        cleanedCourse,
        cleanedBranch,
        parsedYear,
        cleanedSection,
      ]
    );

    res.status(201).json({
      success: true,
      data: formatStudentForAdmin({
        student_id: result.lastInsertRowid,
        name: cleanedName,
        phone_last_four: cleanedPhoneNumber ? cleanedPhoneNumber.slice(-4) : null,
        university_roll_number: cleanedUniversityRoll,
        class_roll_number: parsedClassRoll,
        course: cleanedCourse,
        branch: cleanedBranch,
        year: parsedYear,
        section: cleanedSection
      })
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/students/:id */
router.put('/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_number, university_roll_number, class_roll_number, course, branch, year, section } = req.body;

    const existing = await queryOne('SELECT * FROM students WHERE student_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let finalYear = existing.year;
    if (year !== undefined) {
      finalYear = normalizeYear(year);
      if (!isValidYear(finalYear)) {
        return res.status(400).json({ success: false, message: 'Year must be between 1 and 8.' });
      }
    }

    let finalSection = existing.section;
    if (section !== undefined) {
      finalSection = normalizeSection(section);
      if (!isValidSection(finalSection)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
      }
    }

    let finalUniversityRoll = existing.university_roll_number;
    if (university_roll_number !== undefined) {
      finalUniversityRoll = university_roll_number
        ? normalizeUniversityRollNumber(university_roll_number)
        : '';
      if (!isValidUniversityRollNumber(finalUniversityRoll)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid university roll number.' });
      }
    }
    if (finalUniversityRoll !== existing.university_roll_number) {
      const rollTaken = await queryOne(
        'SELECT student_id FROM students WHERE university_roll_number = ? AND student_id != ?',
        [finalUniversityRoll, Number(id)]
      );
      if (rollTaken) {
        return res.status(409).json({ success: false, message: 'University roll number already registered.' });
      }
    }

    const finalClassRoll = class_roll_number !== undefined
      ? normalizeClassRollNumber(class_roll_number)
      : existing.class_roll_number;
    if (!isValidClassRollNumber(finalClassRoll)) {
      return res.status(400).json({ success: false, message: 'Class roll number must be between 1 and 999.' });
    }

    const finalName = name !== undefined ? String(name).trim().replace(/\s+/g, ' ') : existing.name;
    const finalCourse = course !== undefined ? String(course).trim() : existing.course;
    const finalBranch = branch !== undefined ? String(branch).trim() : existing.branch;
    if (!finalName || !finalCourse || !finalBranch) {
      return res.status(400).json({ success: false, message: 'Name, course, and branch cannot be empty.' });
    }

    let finalPhoneHash = existing.phone_lookup_hash;
    let finalPhoneLastFour = existing.phone_last_four;
    if (phone_number !== undefined && String(phone_number).trim()) {
      const cleanedPhoneNumber = normalizePhoneNumber(phone_number);
      if (!cleanedPhoneNumber) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number.' });
      }
      finalPhoneHash = hashPhoneNumber(cleanedPhoneNumber);
      if (!finalPhoneHash) {
        throw new Error('PHONE_LOOKUP_SECRET is not configured.');
      }
      const phoneTaken = await queryOne(
        'SELECT student_id FROM students WHERE phone_lookup_hash = ? AND student_id != ?',
        [finalPhoneHash, Number(id)]
      );
      if (phoneTaken) {
        return res.status(409).json({ success: false, message: 'Phone number already registered.' });
      }
      finalPhoneLastFour = cleanedPhoneNumber.slice(-4);
    }

    await execute(
      `UPDATE students
       SET name=?, normalized_name=?, phone_lookup_hash=?, phone_last_four=?,
           university_roll_number=?, class_roll_number=?, course=?, branch=?, year=?, section=?
       WHERE student_id=?`,
      [
        finalName,
        normalizeStudentName(finalName),
        finalPhoneHash,
        finalPhoneLastFour,
        finalUniversityRoll,
        finalClassRoll,
        finalCourse,
        finalBranch,
        finalYear,
        finalSection,
        Number(id)
      ]
    );

    res.json({
      success: true,
      message: 'Student updated successfully.',
      data: formatStudentForAdmin({
        student_id: Number(id),
        name: finalName,
        phone_last_four: finalPhoneLastFour,
        university_roll_number: finalUniversityRoll,
        class_roll_number: finalClassRoll,
        course: finalCourse,
        branch: finalBranch,
        year: finalYear,
        section: finalSection,
      })
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/students/:id */
router.delete('/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT * FROM students WHERE student_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await execute('DELETE FROM students WHERE student_id = ?', [Number(id)]);
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  SUBJECTS CRUD
// ════════════════════════════════════════════════════════════

/** GET /api/admin/subjects */
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const subjects = await queryAll('SELECT * FROM subjects ORDER BY subject_name');
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/subjects */
router.post('/subjects', authenticateToken, async (req, res) => {
  try {
    const subjectName = String(req.body.subject_name || '').trim();
    if (!subjectName) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const existing = await queryOne('SELECT subject_id FROM subjects WHERE subject_name = ?', [subjectName]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Subject already exists.' });
    }

    const result = await execute('INSERT INTO subjects (subject_name) VALUES (?)', [subjectName]);
    res.status(201).json({ success: true, data: { subject_id: result.lastInsertRowid, subject_name: subjectName } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/subjects/:id */
router.put('/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const subjectName = String(req.body.subject_name || '').trim();

    const existing = await queryOne('SELECT * FROM subjects WHERE subject_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (!subjectName) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const nameTaken = await queryOne(
      'SELECT subject_id FROM subjects WHERE subject_name = ? AND subject_id != ?',
      [subjectName, Number(id)]
    );
    if (nameTaken) {
      return res.status(409).json({ success: false, message: 'Subject already exists.' });
    }

    await execute('UPDATE subjects SET subject_name = ? WHERE subject_id = ?', [subjectName, Number(id)]);
    res.json({
      success: true,
      message: 'Subject updated successfully.',
      data: { subject_id: Number(id), subject_name: subjectName }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/subjects/:id */
router.delete('/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT * FROM subjects WHERE subject_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    await execute('DELETE FROM subjects WHERE subject_id = ?', [Number(id)]);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  CLASSROOMS CRUD
// ════════════════════════════════════════════════════════════

/** GET /api/admin/classroom-options */
router.get('/classroom-options', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: getClassroomLocationOptions().map((location) => ({
      floor: location.floor,
      floorLabel: location.floorLabel,
      wing: location.wing,
      room: location.room,
      locationName: location.locationName,
      fullLocationName: location.fullLocationName,
      subLocations: location.subLocations,
      displayLabel: location.displayLabel,
      shortLabel: location.shortLabel,
      isSpecialLocation: location.isSpecialLocation,
    })),
  });
});

/** GET /api/admin/classrooms */
router.get('/classrooms', authenticateToken, async (req, res) => {
  try {
    const { section } = req.query;

    let query = 'SELECT * FROM classrooms';
    const params = [];

    if (section) {
      query += ' WHERE section = ?';
      params.push(normalizeSection(section));
    }

    query += ' ORDER BY section, subject';
    const classrooms = await queryAll(query, params);
    res.json({
      success: true,
      data: classrooms.map((classroom) => {
        const location = parseClassroomLocation(classroom.room);
        return location.valid
          ? {
              ...classroom,
              floor: location.floorLabel,
              floorCode: location.floor,
              wing: location.wing,
              room: location.classroomNumber,
              locationName: location.locationName,
              displayLabel: location.displayLabel,
              isSpecialLocation: location.isSpecialLocation,
            }
          : { ...classroom, locationError: location.error };
      })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/classrooms */
router.post('/classrooms', authenticateToken, async (req, res) => {
  try {
    const section = normalizeSection(req.body.section);
    const subject = String(req.body.subject || '').trim();
    const location = parseClassroomLocation(req.body.room);

    if (!section || !subject || location.isMissing) {
      return res.status(400).json({ success: false, message: 'Section, subject, and classroom number are required.' });
    }
    if (!isValidSection(section)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }
    if (!location.valid) {
      return res.status(400).json({ success: false, message: location.error || CLASSROOM_ERROR });
    }

    const floor = location.floorLabel;
    const wing = location.wing || '';
    const room = location.classroomNumber || location.locationName;

    const existing = await queryOne(
      'SELECT classroom_id FROM classrooms WHERE section = ? AND subject = ?',
      [section, subject]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'This subject is already assigned for this section.' });
    }

    const result = await execute(
      'INSERT INTO classrooms (section, subject, floor, wing, room) VALUES (?, ?, ?, ?, ?)',
      [section, subject, floor, wing, room]
    );

    res.status(201).json({
      success: true,
      data: {
        classroom_id: result.lastInsertRowid,
        section,
        subject,
        floor,
        floorCode: location.floor,
        wing: location.wing,
        room: location.classroomNumber,
        locationName: location.locationName,
        displayLabel: location.displayLabel,
        isSpecialLocation: location.isSpecialLocation,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/classrooms/:id */
router.put('/classrooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { section, subject, room } = req.body;

    const existing = await queryOne('SELECT * FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Classroom assignment not found.' });
    }

    const finalSection = section !== undefined ? normalizeSection(section) : existing.section;
    const finalSubject = subject !== undefined ? String(subject).trim() : existing.subject;
    const location = parseClassroomLocation(room !== undefined ? room : existing.room);

    if (!finalSection || !finalSubject || location.isMissing) {
      return res.status(400).json({ success: false, message: 'Section, subject, and classroom number are required.' });
    }
    if (!isValidSection(finalSection)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }
    if (!location.valid) {
      return res.status(400).json({ success: false, message: location.error || CLASSROOM_ERROR });
    }

    const finalFloor = location.floorLabel;
    const finalWing = location.wing || '';
    const finalRoom = location.classroomNumber || location.locationName;

    const duplicate = await queryOne(
      'SELECT classroom_id FROM classrooms WHERE section = ? AND subject = ? AND classroom_id != ?',
      [finalSection, finalSubject, Number(id)]
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'This subject is already assigned for this section.' });
    }

    await execute(
      'UPDATE classrooms SET section=?, subject=?, floor=?, wing=?, room=? WHERE classroom_id=?',
      [
        finalSection,
        finalSubject,
        finalFloor,
        finalWing,
        finalRoom,
        Number(id)
      ]
    );

    res.json({
      success: true,
      message: 'Classroom updated successfully.',
      data: {
        classroom_id: Number(id),
        section: finalSection,
        subject: finalSubject,
        floor: finalFloor,
        floorCode: location.floor,
        wing: location.wing,
        room: location.classroomNumber,
        locationName: location.locationName,
        displayLabel: location.displayLabel,
        isSpecialLocation: location.isSpecialLocation,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/classrooms/:id */
router.delete('/classrooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT * FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Classroom assignment not found.' });
    }

    await execute('DELETE FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    res.json({ success: true, message: 'Classroom deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  SECTIONS
// ════════════════════════════════════════════════════════════

/** GET /api/admin/sections */
router.get('/sections', authenticateToken, async (req, res) => {
  try {
    const sections = await queryAll('SELECT DISTINCT section FROM students ORDER BY section');
    res.json({ success: true, data: sections.map(s => s.section) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  EXCEL/CSV IMPORT
// ════════════════════════════════════════════════════════════

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV or Excel (.xls, .xlsx) files are allowed.'));
    }
  }
});

function uploadStudentFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The file exceeds the 5MB upload limit.'
      : error.message;
    res.status(status).json({ success: false, message });
  });
}

function getCellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value).trim();
  if (value.text !== undefined) return String(value.text).trim();
  if (value.result !== undefined) return String(value.result).trim();
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || '').join('').trim();
  }
  return String(value).trim();
}

async function readStudentRows(file) {
  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return [];

  const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (sheetRows.length < 2) return [];

  const headers = sheetRows[0].map((value) => (
    getCellText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  ));

  const requiredHeaders = ['name', 'course', 'branch', 'year', 'section'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }
  if (!headers.includes('university_roll_number')) {
    throw new Error('Missing required column: university_roll_number');
  }

  const rows = [];
  for (let index = 1; index < sheetRows.length; index++) {
    const rowNumber = index + 1;
    const worksheetRow = sheetRows[index];
    const row = { rowNumber };
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = getCellText(worksheetRow[columnIndex]);
    });

    if (headers.some((header) => header && row[header] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

/** POST /api/admin/import/students */
router.post('/import/students', authenticateToken, uploadStudentFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    let data;
    try {
      data = await readStudentRows(req.file);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Could not read the import file. ${error.message}`
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'The file has no student rows.' });
    }

    let skipped = 0;
    const errors = [];
    const candidates = [];
    const seenRolls = new Set();
    const seenPhones = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = String(row.name || '').trim().replace(/\s+/g, ' ');
      const universityRoll = row.university_roll_number
        ? normalizeUniversityRollNumber(row.university_roll_number)
        : null;
      const classRoll = normalizeClassRollNumber(row.class_roll_number);
      const course = String(row.course || '').trim();
      const branch = String(row.branch || '').trim();
      const year = normalizeYear(row.year);
      const section = normalizeSection(row.section);
      const suppliedPhone = String(row.phone_number || '').trim();
      const phoneNumber = suppliedPhone ? normalizePhoneNumber(suppliedPhone) : null;

      if (!name || !course || !branch || !year || !section) {
        errors.push(`Row ${row.rowNumber}: Missing required fields`);
        skipped++;
        continue;
      }
      if (!universityRoll) {
        errors.push(`Row ${row.rowNumber}: University roll number is required`);
        skipped++;
        continue;
      }
      if (!isValidUniversityRollNumber(universityRoll)) {
        errors.push(`Row ${row.rowNumber}: Invalid university roll number`);
        skipped++;
        continue;
      }
      if (!isValidClassRollNumber(classRoll)) {
        errors.push(`Row ${row.rowNumber}: Invalid class roll number`);
        skipped++;
        continue;
      }
      if (!isValidYear(year)) {
        errors.push(`Row ${row.rowNumber}: Invalid year`);
        skipped++;
        continue;
      }
      if (!isValidSection(section)) {
        errors.push(`Row ${row.rowNumber}: Invalid section`);
        skipped++;
        continue;
      }
      if (suppliedPhone && !phoneNumber) {
        errors.push(`Row ${row.rowNumber}: Invalid phone number`);
        skipped++;
        continue;
      }

      if (seenRolls.has(universityRoll)) {
        errors.push(`Row ${row.rowNumber}: Duplicate university roll number in import file`);
        skipped++;
        continue;
      }
      const phoneHash = phoneNumber ? hashPhoneNumber(phoneNumber) : null;
      if (phoneNumber && !phoneHash) {
        throw new Error('PHONE_LOOKUP_SECRET is not configured.');
      }
      if (phoneHash && seenPhones.has(phoneHash)) {
        errors.push(`Row ${row.rowNumber}: Duplicate phone number in import file`);
        skipped++;
        continue;
      }
      seenRolls.add(universityRoll);
      if (phoneHash) seenPhones.add(phoneHash);
      candidates.push({
        rowNumber: row.rowNumber,
        universityRoll,
        phoneHash,
        values: [
          name,
          normalizeStudentName(name),
          phoneHash,
          phoneNumber ? phoneNumber.slice(-4) : null,
          universityRoll,
          classRoll,
          course,
          branch,
          year,
          section,
        ],
      });
    }

    const importResult = await withTransaction(async (transaction) => {
      const registeredRolls = new Set();
      const registeredPhones = new Set();

      for (let offset = 0; offset < candidates.length; offset += 400) {
        const chunk = candidates.slice(offset, offset + 400);
        const placeholders = chunk.map(() => '?').join(', ');
        const rows = await transaction.queryAll(
          `SELECT university_roll_number FROM students WHERE university_roll_number IN (${placeholders})`,
          chunk.map((candidate) => candidate.universityRoll)
        );
        for (const row of rows) registeredRolls.add(row.university_roll_number);
      }

      const phoneCandidates = candidates.filter((candidate) => candidate.phoneHash);
      for (let offset = 0; offset < phoneCandidates.length; offset += 400) {
        const chunk = phoneCandidates.slice(offset, offset + 400);
        const placeholders = chunk.map(() => '?').join(', ');
        const rows = await transaction.queryAll(
          `SELECT phone_lookup_hash FROM students WHERE phone_lookup_hash IN (${placeholders})`,
          chunk.map((candidate) => candidate.phoneHash)
        );
        for (const row of rows) registeredPhones.add(row.phone_lookup_hash);
      }

      const pending = [];
      for (const candidate of candidates) {
        if (registeredRolls.has(candidate.universityRoll)) {
          errors.push(`Row ${candidate.rowNumber}: University roll number already registered`);
          skipped++;
        } else if (candidate.phoneHash && registeredPhones.has(candidate.phoneHash)) {
          errors.push(`Row ${candidate.rowNumber}: Phone number already registered`);
          skipped++;
        } else {
          pending.push(candidate);
        }
      }

      const result = await transaction.insertMany(
        'students',
        [
          'name',
          'normalized_name',
          'phone_lookup_hash',
          'phone_last_four',
          'university_roll_number',
          'class_roll_number',
          'course',
          'branch',
          'year',
          'section',
        ],
        pending.map((candidate) => candidate.values),
        { suffix: 'ON CONFLICT (university_roll_number) DO NOTHING', chunkSize: 200 }
      );

      return { imported: result.changes, attempted: pending.length };
    });

    if (importResult.imported < importResult.attempted) {
      const conflicts = importResult.attempted - importResult.imported;
      skipped += conflicts;
      errors.push(`${conflicts} row(s): University roll number was registered during import`);
    }

    const displayedErrors = errors.slice(0, 100);
    res.json({
      success: true,
      data: {
        total: data.length,
        imported: importResult.imported,
        skipped,
        errors: displayedErrors,
        omittedErrors: Math.max(0, errors.length - displayedErrors.length)
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: 'Failed to import file.' });
  }
});

const timetableImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const allowedExtension = /\.(png|jpe?g|webp)$/i.test(file.originalname);
    callback(
      allowedMime.has(file.mimetype) && allowedExtension
        ? null
        : new Error('Only PNG, JPG, JPEG, and WEBP images are allowed.'),
      allowedMime.has(file.mimetype) && allowedExtension
    );
  },
});

function uploadTimetableImage(req, res, next) {
  timetableImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: error.code === 'LIMIT_FILE_SIZE' ? 'The image exceeds the 5MB upload limit.' : error.message,
    });
  });
}

async function getTimetableContext(section) {
  return queryOne(
    `SELECT course, branch, year, section
     FROM students WHERE section = ? ORDER BY student_id LIMIT 1`,
    [String(section || '').trim().toUpperCase()]
  );
}

async function getTimetableRows(section, operations = { queryAll }) {
  return operations.queryAll(
    `SELECT * FROM timetable_entries
     WHERE section = ?
     ORDER BY day_of_week, start_time, end_time`,
    [String(section || '').trim().toUpperCase()]
  );
}

function timetableResponseRow(row) {
  return formatEntry(row);
}

function timetableMetadataErrors(body, context) {
  const errors = [];
  if (!context) errors.push('Select an existing class or section.');
  if (!String(body.course || '').trim()) errors.push('Course is required.');
  if (!Number(body.year)) errors.push('Year is required.');
  if (context && (
    String(context.course) !== String(body.course).trim()
    || Number(context.year) !== Number(body.year)
  )) errors.push('Course, year, and class must match an existing student class.');
  return errors;
}

function timetableId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isTimetableConflict(error) {
  return error?.code === '23505' || /unique constraint/i.test(String(error?.message || ''));
}

async function validateTimetableRequest(body, { includeExisting = true, excludeId = null } = {}) {
  const section = String(body.section || '').trim().toUpperCase();
  const context = await getTimetableContext(section);
  const metadataErrors = timetableMetadataErrors(body, context);

  const existing = includeExisting && context
    ? (await getTimetableRows(section)).filter((row) => String(row.timetable_entry_id) !== String(excludeId))
    : [];
  const rows = validateRows(Array.isArray(body.rows) ? body.rows : [], existing);
  return { context, metadataErrors, rows, valid: !metadataErrors.length && rows.length > 0 && rows.every((row) => row.status === 'valid') };
}

/** GET /api/admin/timetables */
router.get('/timetables', authenticateToken, async (req, res) => {
  try {
    const classes = await queryAll(
      `SELECT course, branch, year, section, COUNT(DISTINCT student_id) AS student_count
       FROM students GROUP BY course, branch, year, section
       ORDER BY course, branch, year, section`
    );
    res.json({ success: true, data: { classes } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load timetable classes.' });
  }
});

/** GET /api/admin/timetables/:classId */
router.get('/timetables/:classId', authenticateToken, async (req, res) => {
  try {
    const context = await getTimetableContext(req.params.classId);
    if (!context) return res.status(404).json({ success: false, message: 'Class not found.' });
    const rows = (await getTimetableRows(context.section)).map(timetableResponseRow);
    res.json({ success: true, data: { context, days: DAYS, rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load this timetable.' });
  }
});

/** POST /api/admin/timetables/validate */
router.post('/timetables/validate', authenticateToken, async (req, res) => {
  try {
    const mode = req.body.mode === 'replace' ? 'replace' : 'merge';
    const result = await validateTimetableRequest(req.body, { includeExisting: mode === 'merge' });
    res.status(result.valid ? 200 : 422).json({ success: result.valid, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not validate the timetable.' });
  }
});

/** POST /api/admin/timetables/shift */
router.post('/timetables/shift', authenticateToken, async (req, res) => {
  try {
    const section = String(req.body.section || '').trim().toUpperCase();
    const context = await getTimetableContext(section);
    const metadataErrors = timetableMetadataErrors(req.body, context);
    if (metadataErrors.length) {
      return res.status(context ? 400 : 404).json({ success: false, message: metadataErrors[0] });
    }

    const schedule = await getTimetableRows(section);
    const requestedIds = new Set((req.body.entryIds || []).map(String));
    const day = req.body.day ? String(req.body.day) : '';
    const afterTime = String(req.body.afterTime || '00:00');
    const selected = schedule.filter((entry) => (
      requestedIds.size
        ? requestedIds.has(String(entry.timetable_entry_id))
        : (!day || formatEntry(entry).day === day) && entry.start_time >= afterTime
    ));
    if (!selected.length) {
      return res.status(400).json({ success: false, message: 'Select at least one timetable entry to shift.' });
    }

    const selectedIds = new Set(selected.map((entry) => String(entry.timetable_entry_id)));
    const untouched = schedule.filter((entry) => !selectedIds.has(String(entry.timetable_entry_id)));
    const rows = shiftRows(selected, {
      direction: req.body.direction,
      minutes: Number(req.body.minutes),
    }, untouched);
    const valid = rows.every((row) => row.status === 'valid');
    if (!valid) {
      return res.status(422).json({
        success: false,
        message: 'Time conflict detected after shifting. Please review the affected entries before saving.',
        data: { rows, valid: false },
      });
    }
    if (!req.body.confirm) return res.json({ success: true, data: { rows, valid: true, saved: false } });

    await withTransaction(async (transaction) => {
      for (const row of rows) {
        await transaction.execute(
          `UPDATE timetable_entries SET start_time=?, end_time=?, source_label=? WHERE timetable_entry_id=?`,
          [row.startTime, row.endTime, 'ADMIN', row.timetableEntryId]
        );
      }
    });
    res.json({ success: true, message: `${rows.length} timetable ${rows.length === 1 ? 'entry' : 'entries'} shifted successfully.`, data: { rows, valid: true, saved: true } });
  } catch (error) {
    console.error('Timetable shift failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not shift timetable entries.' });
  }
});

/** POST /api/admin/timetables/import */
router.post('/timetables/import', authenticateToken, uploadTimetableImage, async (req, res) => {
  try {
    const context = await getTimetableContext(req.body.section);
    const metadataErrors = timetableMetadataErrors(req.body, context);
    if (metadataErrors.length) {
      return res.status(context ? 400 : 404).json({ success: false, message: metadataErrors[0], data: { metadataErrors } });
    }
    if (req.file && req.body.text) {
      return res.status(400).json({ success: false, message: 'Choose either an image or pasted text for each import.' });
    }
    if (!req.file && !String(req.body.text || '').trim()) {
      return res.status(400).json({ success: false, message: 'Upload an image or paste timetable text.' });
    }
    const extraction = req.file
      ? await extractTimetableImage(req.file.buffer)
      : { text: String(req.body.text), rows: null };
    const extractedText = extraction.text;
    const rows = extraction.rows?.length
      ? validateRows(extraction.rows)
      : parseTimetableText(extractedText);
    if (!rows.length) {
      return res.status(422).json({
        success: false,
        message: 'No timetable entries could be read. Try a clearer image or paste the timetable as text.',
        data: { rows, extractedText: req.file ? extractedText : undefined, saved: false },
      });
    }
    res.json({
      success: true,
      data: {
        rows,
        extractedText: req.file ? extractedText : undefined,
        saved: false,
      },
    });
  } catch (error) {
    console.error('Timetable import failed:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status === 429 ? error.message : 'Could not extract timetable entries. Review the image or text and try again.',
    });
  }
});

/** POST /api/admin/timetables */
router.post('/timetables', authenticateToken, async (req, res) => {
  try {
    const mode = req.body.mode === 'replace' ? 'replace' : 'merge';
    const validation = await validateTimetableRequest(req.body, { includeExisting: mode === 'merge' });
    if (!validation.valid) {
      return res.status(422).json({ success: false, message: 'Fix timetable validation errors before saving.', data: validation });
    }
    const section = validation.context.section;
    const current = await getTimetableRows(section);
    const academicSession = String(req.body.academicSession || current[0]?.academic_session || '2026-27');
    const semester = String(req.body.semester || current[0]?.semester || 'III');
    await withTransaction(async (transaction) => {
      if (mode === 'replace') await transaction.execute('DELETE FROM timetable_entries WHERE section = ?', [section]);
      await transaction.insertMany(
        'timetable_entries',
        [
          'section', 'day_of_week', 'start_time', 'end_time', 'subject_code', 'subject_name',
          'session_type', 'faculty_code', 'faculty_name', 'room', 'academic_session', 'semester', 'source_label', 'notes',
        ],
        validation.rows.map((row) => [
          section, row.dayOfWeek, row.startTime, row.endTime, row.subjectCode || null, row.subjectName,
          row.sessionType, row.facultyCode || null, row.facultyName, row.room, academicSession, semester, 'ADMIN', row.notes || null,
        ])
      );
    });
    res.status(201).json({ success: true, message: 'Timetable saved successfully.' });
  } catch (error) {
    console.error('Timetable save failed:', error.message);
    if (isTimetableConflict(error)) {
      return res.status(409).json({ success: false, message: 'This change conflicts with an existing timetable entry.' });
    }
    res.status(500).json({ success: false, message: 'Could not save the timetable.' });
  }
});

/** PUT /api/admin/timetables/:id */
router.put('/timetables/:id', authenticateToken, async (req, res) => {
  try {
    const id = timetableId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid timetable entry ID.' });
    const current = await queryOne('SELECT * FROM timetable_entries WHERE timetable_entry_id = ?', [id]);
    if (!current) return res.status(404).json({ success: false, message: 'Timetable entry not found.' });
    const context = await getTimetableContext(current.section);
    if (!context) return res.status(404).json({ success: false, message: 'Class not found.' });
    const validation = await validateTimetableRequest({
      ...req.body,
      course: context.course,
      year: context.year,
      section: context.section,
      rows: [{ ...req.body, timetableEntryId: id }],
    }, { excludeId: id });
    if (!validation.valid) {
      return res.status(422).json({ success: false, message: 'Fix timetable validation errors before saving.', data: validation });
    }
    const row = validation.rows[0];
    await execute(
      `UPDATE timetable_entries
       SET day_of_week=?, start_time=?, end_time=?, subject_code=?, subject_name=?, session_type=?,
           faculty_code=?, faculty_name=?, room=?, source_label=?, notes=?
       WHERE timetable_entry_id=?`,
      [
        row.dayOfWeek, row.startTime, row.endTime, row.subjectCode || null, row.subjectName,
        row.sessionType, row.facultyCode || null, row.facultyName || null, row.room || null, 'ADMIN', row.notes || null, id,
      ]
    );
    res.json({ success: true, message: 'Timetable entry updated successfully.' });
  } catch (error) {
    if (isTimetableConflict(error)) {
      return res.status(409).json({ success: false, message: 'This change conflicts with an existing timetable entry.' });
    }
    res.status(500).json({ success: false, message: 'Could not update the timetable entry.' });
  }
});

/** DELETE /api/admin/timetables/class/:classId */
router.delete('/timetables/class/:classId', authenticateToken, async (req, res) => {
  try {
    const context = await getTimetableContext(req.params.classId);
    if (!context) return res.status(404).json({ success: false, message: 'Class not found.' });
    const result = await execute('DELETE FROM timetable_entries WHERE section = ?', [context.section]);
    console.info(`Admin deleted timetable for ${context.section}: ${result.changes} entries.`);
    res.json({
      success: true,
      deletedCount: result.changes,
      message: result.changes
        ? 'Complete timetable deleted successfully.'
        : 'No timetable entries existed for this class.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not delete the complete timetable.' });
  }
});

/** DELETE /api/admin/timetables/:id */
router.delete('/timetables/:id', authenticateToken, async (req, res) => {
  try {
    const id = timetableId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid timetable entry ID.' });
    const current = await queryOne('SELECT timetable_entry_id FROM timetable_entries WHERE timetable_entry_id = ?', [id]);
    if (!current) return res.status(404).json({ success: false, message: 'Timetable entry not found.' });
    await execute('DELETE FROM timetable_entries WHERE timetable_entry_id = ?', [id]);
    console.info(`Admin deleted timetable entry ${id}.`);
    res.json({ success: true, message: 'Timetable entry deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not delete the timetable entry.' });
  }
});

module.exports = router;
