const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const {
  normalizeUniversityRollNumber,
  isValidUniversityRollNumber,
  normalizeClassRollNumber,
  isValidClassRollNumber,
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

    const admin = await queryOne('SELECT * FROM admins WHERE username = ?', [username]);

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

    let query = 'SELECT * FROM students WHERE 1=1';
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
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/students */
router.post('/students', authenticateToken, async (req, res) => {
  try {
    const { name, university_roll_number, class_roll_number, course, branch, year, section } = req.body;
    const cleanedName = String(name || '').trim();
    const cleanedUniversityRoll = university_roll_number
      ? normalizeUniversityRollNumber(university_roll_number)
      : null;
    const parsedClassRoll = normalizeClassRollNumber(class_roll_number);
    const cleanedCourse = String(course || '').trim();
    const cleanedBranch = String(branch || '').trim();
    const cleanedSection = normalizeSection(section);
    const parsedYear = normalizeYear(year);

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

    const existingUniversityRoll = await queryOne(
      'SELECT student_id FROM students WHERE university_roll_number = ?',
      [cleanedUniversityRoll]
    );
    if (existingUniversityRoll) {
      return res.status(409).json({ success: false, message: 'University roll number already registered.' });
    }

    const result = await execute(
      `INSERT INTO students (
         name, university_roll_number, class_roll_number, course, branch, year, section
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cleanedName, cleanedUniversityRoll, parsedClassRoll, cleanedCourse, cleanedBranch, parsedYear, cleanedSection]
    );

    res.status(201).json({
      success: true,
      data: {
        student_id: result.lastInsertRowid,
        name: cleanedName,
        university_roll_number: cleanedUniversityRoll,
        class_roll_number: parsedClassRoll,
        course: cleanedCourse,
        branch: cleanedBranch,
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
router.put('/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, university_roll_number, class_roll_number, course, branch, year, section } = req.body;

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

    const finalName = name !== undefined ? String(name).trim() : existing.name;
    const finalCourse = course !== undefined ? String(course).trim() : existing.course;
    const finalBranch = branch !== undefined ? String(branch).trim() : existing.branch;
    if (!finalName || !finalCourse || !finalBranch) {
      return res.status(400).json({ success: false, message: 'Name, course, and branch cannot be empty.' });
    }

    await execute(
      `UPDATE students
       SET name=?, university_roll_number=?, class_roll_number=?, course=?, branch=?, year=?, section=?
       WHERE student_id=?`,
      [
        finalName,
        finalUniversityRoll,
        finalClassRoll,
        finalCourse,
        finalBranch,
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
    res.json({ success: true, message: 'Subject updated successfully.' });
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
    res.json({ success: true, data: classrooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** POST /api/admin/classrooms */
router.post('/classrooms', authenticateToken, async (req, res) => {
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
      data: { classroom_id: result.lastInsertRowid, section, subject, floor, wing, room }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/** PUT /api/admin/classrooms/:id */
router.put('/classrooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { section, subject, floor, wing, room } = req.body;

    const existing = await queryOne('SELECT * FROM classrooms WHERE classroom_id = ?', [Number(id)]);
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

    res.json({ success: true, message: 'Classroom updated successfully.' });
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
    if (file.originalname.match(/\.(xlsx|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx) and CSV files are allowed.'));
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
  const workbook = new ExcelJS.Workbook();
  const extension = path.extname(file.originalname).toLowerCase();
  let worksheet;

  if (extension === '.xlsx') {
    await workbook.xlsx.load(file.buffer);
    worksheet = workbook.worksheets[0];
  } else {
    worksheet = await workbook.csv.read(Readable.from([file.buffer]));
  }

  if (!worksheet || worksheet.actualRowCount < 2) return [];

  const headerRow = worksheet.getRow(1);
  const headers = [];
  for (let column = 1; column <= worksheet.actualColumnCount; column++) {
    headers.push(
      getCellText(headerRow.getCell(column).value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
    );
  }

  const requiredHeaders = ['name', 'course', 'branch', 'year', 'section'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }
  if (!headers.includes('university_roll_number')) {
    throw new Error('Missing required column: university_roll_number');
  }

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const worksheetRow = worksheet.getRow(rowNumber);
    const row = { rowNumber };
    headers.forEach((header, index) => {
      if (header) row[header] = getCellText(worksheetRow.getCell(index + 1).value);
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

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = String(row.name || '').trim();
      const universityRoll = row.university_roll_number
        ? normalizeUniversityRollNumber(row.university_roll_number)
        : null;
      const classRoll = normalizeClassRollNumber(row.class_roll_number);
      const course = String(row.course || '').trim();
      const branch = String(row.branch || '').trim();
      const year = normalizeYear(row.year);
      const section = normalizeSection(row.section);

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

      try {
        const existing = await queryOne(
          'SELECT student_id FROM students WHERE university_roll_number = ?',
          [universityRoll]
        );
        if (existing) {
          errors.push(`Row ${row.rowNumber}: University roll number already registered`);
          skipped++;
          continue;
        }
        await execute(
          `INSERT INTO students (
             name, university_roll_number, class_roll_number, course, branch, year, section
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, universityRoll, classRoll, course, branch, year, section]
        );
        imported++;
      } catch (err) {
        errors.push(`Row ${row.rowNumber}: ${err.message}`);
        skipped++;
      }
    }

    const displayedErrors = errors.slice(0, 100);
    res.json({
      success: true,
      data: {
        total: data.length,
        imported,
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

module.exports = router;
