const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const configuredDatabasePath = String(process.env.DATABASE_PATH || '').trim();
const DB_PATH = configuredDatabasePath
  ? path.resolve(configuredDatabasePath)
  : path.join(__dirname, '..', 'database.sqlite');

let db = null;
let dbReady = null;

function migrateStudentsTable() {
  const columns = queryAll('PRAGMA table_info(students)');
  const expectedColumns = [
    'student_id',
    'name',
    'university_roll_number',
    'class_roll_number',
    'course',
    'branch',
    'year',
    'section',
    'created_at',
  ];
  const hasUniversityRoll = columns.some((column) => column.name === 'university_roll_number');
  const hasClassRoll = columns.some((column) => column.name === 'class_roll_number');
  const universityRollColumn = columns.find((column) => column.name === 'university_roll_number');
  const hasExactColumns = columns.length === expectedColumns.length
    && expectedColumns.every((name) => columns.some((column) => column.name === name));

  if (hasExactColumns && hasUniversityRoll && hasClassRoll && universityRollColumn?.notnull === 1) return;

  if (!hasUniversityRoll) {
    throw new Error('Student records must be assigned university roll numbers before upgrading the database.');
  }

  const studentsWithoutRoll = queryOne(
    'SELECT COUNT(*) AS count FROM students WHERE university_roll_number IS NULL OR TRIM(university_roll_number) = ? ',
    ['']
  );
  if (studentsWithoutRoll.count > 0) {
    throw new Error('Every student must have a university roll number before upgrading the student schema.');
  }

  db.run('DROP TABLE IF EXISTS students_migrated');
  db.run('BEGIN TRANSACTION');
  try {
    db.run(`
      CREATE TABLE students_migrated (
        student_id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name                   TEXT NOT NULL,
        university_roll_number TEXT NOT NULL UNIQUE,
        class_roll_number      INTEGER,
        course                 TEXT NOT NULL,
        branch                 TEXT NOT NULL,
        year                   INTEGER NOT NULL,
        section                TEXT NOT NULL,
        created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const classRollExpression = hasClassRoll ? 'class_roll_number' : 'NULL';
    db.run(`
      INSERT INTO students_migrated (
        student_id, name, university_roll_number, class_roll_number,
        course, branch, year, section, created_at
      )
      SELECT
        student_id, name, university_roll_number, ${classRollExpression},
        course, branch, year, section, created_at
      FROM students
    `);
    db.run('DROP TABLE students');
    db.run('ALTER TABLE students_migrated RENAME TO students');
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * Initialize sql.js and load or create the database.
 * Returns a promise that resolves to the db instance.
 */
function initDatabase() {
  if (dbReady) return dbReady;

  dbReady = initSqlJs().then((SQL) => {
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        student_id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name                   TEXT NOT NULL,
        university_roll_number TEXT NOT NULL UNIQUE,
        class_roll_number      INTEGER,
        course                 TEXT NOT NULL,
        branch                 TEXT NOT NULL,
        year                   INTEGER NOT NULL,
        section                TEXT NOT NULL,
        created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    migrateStudentsTable();

    db.run(`
      CREATE TABLE IF NOT EXISTS subjects (
        subject_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_name TEXT NOT NULL UNIQUE,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS classrooms (
        classroom_id INTEGER PRIMARY KEY AUTOINCREMENT,
        section      TEXT NOT NULL,
        subject      TEXT NOT NULL,
        floor        TEXT NOT NULL,
        wing         TEXT NOT NULL,
        room         TEXT NOT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        admin_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT NOT NULL UNIQUE,
        password   TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS timetable_entries (
        timetable_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        section            TEXT NOT NULL,
        day_of_week        INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
        start_time         TEXT NOT NULL,
        end_time           TEXT NOT NULL,
        subject_code       TEXT,
        subject_name       TEXT NOT NULL,
        session_type       TEXT NOT NULL,
        faculty_code       TEXT,
        faculty_name       TEXT,
        room               TEXT,
        academic_session   TEXT NOT NULL,
        semester           TEXT NOT NULL,
        source_label       TEXT,
        created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (section, day_of_week, start_time, academic_session)
      )
    `);

    // Indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_students_university_roll ON students(university_roll_number)');
    db.run('CREATE INDEX IF NOT EXISTS idx_students_section ON students(section)');
    db.run('CREATE INDEX IF NOT EXISTS idx_classrooms_section ON classrooms(section)');
    db.run('CREATE INDEX IF NOT EXISTS idx_timetable_section_day ON timetable_entries(section, day_of_week, start_time)');

    saveDatabase();
    console.log('✅ Database initialized successfully');
    return db;
  });

  return dbReady;
}

/**
 * Get the database instance (sync — call after initDatabase resolves).
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Persist database to disk.
 */
function saveDatabase() {
  if (db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * Helper: run a query and return all results as an array of objects.
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Helper: run a query and return the first result as an object, or null.
 */
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Helper: execute a statement (INSERT/UPDATE/DELETE) and return changes info.
 */
function execute(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = queryOne('SELECT last_insert_rowid() as id');
  saveDatabase();
  return { changes, lastInsertRowid: lastId ? lastId.id : null };
}

module.exports = { DB_PATH, initDatabase, getDatabase, saveDatabase, queryAll, queryOne, execute };
