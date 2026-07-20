const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db = null;
let dbReady = null;

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
        student_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        phone      TEXT NOT NULL UNIQUE,
        course     TEXT NOT NULL,
        branch     TEXT NOT NULL,
        year       INTEGER NOT NULL,
        section    TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone)');
    db.run('CREATE INDEX IF NOT EXISTS idx_students_section ON students(section)');
    db.run('CREATE INDEX IF NOT EXISTS idx_classrooms_section ON classrooms(section)');

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

module.exports = { initDatabase, getDatabase, saveDatabase, queryAll, queryOne, execute };
