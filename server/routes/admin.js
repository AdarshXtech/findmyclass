const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const {
  normalizePhone,
  isValidPhone,
  normalizeSection,
  isValidSection,
  normalizeWing,
  isValidWing,
  normalizeYear,
  isValidYear,
} = require('../utils/validation');

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    const admin = queryOne('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

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
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const totalStudents   = queryOne('SELECT COUNT(*) as count FROM students').count;
    const totalSubjects   = queryOne('SELECT COUNT(*) as count FROM subjects').count;
    const totalClassrooms = queryOne('SELECT COUNT(*) as count FROM classrooms').count;
    const totalSections   = queryOne('SELECT COUNT(DISTINCT section) as count FROM students').count;

    const sectionWise = queryAll(
      'SELECT section, COUNT(*) as count FROM students GROUP BY section ORDER BY section'
    );

    res.json({
      success: true,
      data: { totalStudents, totalSubjects, totalClassrooms, totalSections, sectionWise }
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
router.get('/students', authenticateToken, (req, res) => {
  try {
    const { search, section } = req.query;

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (section) {
      const normalizedSection = normalizeSection(section);
      query += ' AND section = ?';
      params.push(normalizedSection);
    }

    query += ' ORDER BY name';
    const students = queryAll(query, params);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/students */
router.post('/students', authenticateToken, (req, res) => {
  try {
    const { name, phone, course, branch, year, section } = req.body;
    const cleanedPhone = normalizePhone(phone);
    const cleanedSection = normalizeSection(section);
    const parsedYear = normalizeYear(year);

    if (!name || !phone || !course || !branch || !year || !section) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidPhone(cleanedPhone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
    }
    if (!isValidYear(parsedYear)) {
      return res.status(400).json({ success: false, message: 'Year must be between 1 and 8.' });
    }
    if (!isValidSection(cleanedSection)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }

    const existing = queryOne('SELECT student_id FROM students WHERE phone = ?', [cleanedPhone]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    const result = execute(
      'INSERT INTO students (name, phone, course, branch, year, section) VALUES (?, ?, ?, ?, ?, ?)',
      [String(name).trim(), cleanedPhone, String(course).trim(), String(branch).trim(), parsedYear, cleanedSection]
    );

    res.status(201).json({
      success: true,
      data: {
        student_id: result.lastInsertRowid,
        name: String(name).trim(),
        phone: cleanedPhone,
        course: String(course).trim(),
        branch: String(branch).trim(),
        year: parsedYear,
        section: cleanedSection
      }
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/students/:id */
router.put('/students/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, course, branch, year, section } = req.body;

    const existing = queryOne('SELECT * FROM students WHERE student_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let finalPhone = existing.phone;
    if (phone !== undefined) {
      finalPhone = normalizePhone(phone);
      if (!isValidPhone(finalPhone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
      }
    }

    if (finalPhone !== existing.phone) {
      const phoneTaken = queryOne('SELECT student_id FROM students WHERE phone = ? AND student_id != ?', [finalPhone, Number(id)]);
      if (phoneTaken) {
        return res.status(409).json({ success: false, message: 'Phone number already registered.' });
      }
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

    execute(
      'UPDATE students SET name=?, phone=?, course=?, branch=?, year=?, section=? WHERE student_id=?',
      [
        name !== undefined ? String(name).trim() : existing.name,
        finalPhone,
        course !== undefined ? String(course).trim() : existing.course,
        branch !== undefined ? String(branch).trim() : existing.branch,
        finalYear,
        finalSection,
        Number(id)
      ]
    );

    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/students/:id */
router.delete('/students/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const existing = queryOne('SELECT * FROM students WHERE student_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    execute('DELETE FROM students WHERE student_id = ?', [Number(id)]);
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
router.get('/subjects', authenticateToken, (req, res) => {
  try {
    const subjects = queryAll('SELECT * FROM subjects ORDER BY subject_name');
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/subjects */
router.post('/subjects', authenticateToken, (req, res) => {
  try {
    const subjectName = String(req.body.subject_name || '').trim();
    if (!subjectName) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const existing = queryOne('SELECT subject_id FROM subjects WHERE subject_name = ?', [subjectName]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Subject already exists.' });
    }

    const result = execute('INSERT INTO subjects (subject_name) VALUES (?)', [subjectName]);
    res.status(201).json({ success: true, data: { subject_id: result.lastInsertRowid, subject_name: subjectName } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/subjects/:id */
router.put('/subjects/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const subjectName = String(req.body.subject_name || '').trim();

    const existing = queryOne('SELECT * FROM subjects WHERE subject_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (!subjectName) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const nameTaken = queryOne(
      'SELECT subject_id FROM subjects WHERE subject_name = ? AND subject_id != ?',
      [subjectName, Number(id)]
    );
    if (nameTaken) {
      return res.status(409).json({ success: false, message: 'Subject already exists.' });
    }

    execute('UPDATE subjects SET subject_name = ? WHERE subject_id = ?', [subjectName, Number(id)]);
    res.json({ success: true, message: 'Subject updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/subjects/:id */
router.delete('/subjects/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const existing = queryOne('SELECT * FROM subjects WHERE subject_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    execute('DELETE FROM subjects WHERE subject_id = ?', [Number(id)]);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  CLASSROOMS CRUD
// ════════════════════════════════════════════════════════════

/** GET /api/admin/classrooms */
router.get('/classrooms', authenticateToken, (req, res) => {
  try {
    const { section } = req.query;

    let query = 'SELECT * FROM classrooms';
    const params = [];

    if (section) {
      query += ' WHERE section = ?';
      params.push(section);
    }

    query += ' ORDER BY section, subject';
    const classrooms = queryAll(query, params);
    res.json({ success: true, data: classrooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/classrooms */
router.post('/classrooms', authenticateToken, (req, res) => {
  try {
    const section = normalizeSection(req.body.section);
    const subject = String(req.body.subject || '').trim();
    const floor = String(req.body.floor || '').trim();
    const wing = normalizeWing(req.body.wing);
    const room = String(req.body.room || '').trim();

    if (!section || !subject || !floor || !wing || !room) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidSection(section)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }
    if (!isValidWing(wing)) {
      return res.status(400).json({ success: false, message: 'Wing must be A, B, or C.' });
    }

    const existing = queryOne(
      'SELECT classroom_id FROM classrooms WHERE section = ? AND subject = ?',
      [section, subject]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'This subject is already assigned for this section.' });
    }

    const result = execute(
      'INSERT INTO classrooms (section, subject, floor, wing, room) VALUES (?, ?, ?, ?, ?)',
      [section, subject, floor, wing, room]
    );

    res.status(201).json({
      success: true,
      data: { classroom_id: result.lastInsertRowid, section, subject, floor, wing, room }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/classrooms/:id */
router.put('/classrooms/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { section, subject, floor, wing, room } = req.body;

    const existing = queryOne('SELECT * FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Classroom assignment not found.' });
    }

    const finalSection = section !== undefined ? normalizeSection(section) : existing.section;
    const finalSubject = subject !== undefined ? String(subject).trim() : existing.subject;
    const finalFloor = floor !== undefined ? String(floor).trim() : existing.floor;
    const finalWing = wing !== undefined ? normalizeWing(wing) : existing.wing;
    const finalRoom = room !== undefined ? String(room).trim() : existing.room;

    if (!finalSection || !finalSubject || !finalFloor || !finalWing || !finalRoom) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidSection(finalSection)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid section.' });
    }
    if (!isValidWing(finalWing)) {
      return res.status(400).json({ success: false, message: 'Wing must be A, B, or C.' });
    }

    const duplicate = queryOne(
      'SELECT classroom_id FROM classrooms WHERE section = ? AND subject = ? AND classroom_id != ?',
      [finalSection, finalSubject, Number(id)]
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'This subject is already assigned for this section.' });
    }

    execute(
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

    res.json({ success: true, message: 'Classroom updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** DELETE /api/admin/classrooms/:id */
router.delete('/classrooms/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const existing = queryOne('SELECT * FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Classroom assignment not found.' });
    }

    execute('DELETE FROM classrooms WHERE classroom_id = ?', [Number(id)]);
    res.json({ success: true, message: 'Classroom deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════
//  SECTIONS
// ════════════════════════════════════════════════════════════

/** GET /api/admin/sections */
router.get('/sections', authenticateToken, (req, res) => {
  try {
    const sections = queryAll('SELECT DISTINCT section FROM students ORDER BY section');
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
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

/** POST /api/admin/import/students */
router.post('/import/students', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'The file is empty.' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name    = row.Name    || row.name    || row.NAME;
      const phone   = normalizePhone(row.Phone || row.phone || row.PHONE || '');
      const course  = row.Course  || row.course  || row.COURSE;
      const branch  = row.Branch  || row.branch  || row.BRANCH;
      const year    = normalizeYear(row.Year || row.year || row.YEAR);
      const section = normalizeSection(row.Section || row.section || row.SECTION);

      if (!name || !phone || !course || !branch || !year || !section) {
        errors.push(`Row ${i + 2}: Missing required fields`);
        skipped++;
        continue;
      }
      if (!isValidPhone(phone)) {
        errors.push(`Row ${i + 2}: Invalid phone number`);
        skipped++;
        continue;
      }
      if (!isValidYear(year)) {
        errors.push(`Row ${i + 2}: Invalid year`);
        skipped++;
        continue;
      }
      if (!isValidSection(section)) {
        errors.push(`Row ${i + 2}: Invalid section`);
        skipped++;
        continue;
      }

      try {
        const existing = queryOne('SELECT student_id FROM students WHERE phone = ?', [phone]);
        if (existing) {
          skipped++;
          continue;
        }
        execute(
          'INSERT INTO students (name, phone, course, branch, year, section) VALUES (?, ?, ?, ?, ?, ?)',
          [String(name).trim(), phone, String(course).trim(), String(branch).trim(), year, section]
        );
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err.message}`);
        skipped++;
      }
    }

    res.json({
      success: true,
      data: { total: data.length, imported, skipped, errors: errors.slice(0, 10) }
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: 'Failed to import file.' });
  }
});

module.exports = router;
