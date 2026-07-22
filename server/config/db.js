const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { CircuitBreaker } = require('../utils/circuit-breaker');

const configuredDatabasePath = String(process.env.DATABASE_PATH || '').trim();
const DB_PATH = configuredDatabasePath
  ? path.resolve(configuredDatabasePath)
  : path.join(__dirname, '..', 'database.sqlite');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();

let sqlite = null;
let pool = null;
let dbReady = null;

function isPostgresDependencyFailure(error) {
  const code = String(error?.code || '');
  return code === 'DEPENDENCY_TIMEOUT'
    || code.startsWith('08')
    || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300'].includes(code)
    || /connection|timeout|terminated unexpectedly/i.test(String(error?.message || ''));
}

const postgresCircuit = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 10000,
  timeoutMs: 6000,
  maxConcurrent: 8,
  isFailure: isPostgresDependencyFailure,
});

function sqliteQueryAll(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function sqliteQueryOne(sql, params = []) {
  return sqliteQueryAll(sql, params)[0] || null;
}

function migrateSqliteStudentsTable() {
  const columns = sqliteQueryAll('PRAGMA table_info(students)');
  const requiredColumns = [
    'student_id', 'name', 'university_roll_number', 'class_roll_number',
    'course', 'branch', 'year', 'section', 'created_at',
  ];
  const universityRollColumn = columns.find((column) => column.name === 'university_roll_number');
  const hasClassRoll = columns.some((column) => column.name === 'class_roll_number');
  const hasRequiredColumns = requiredColumns.every((name) => columns.some((column) => column.name === name));

  if (hasRequiredColumns && universityRollColumn?.notnull === 1) return;
  if (!universityRollColumn) {
    throw new Error('Student records must be assigned university roll numbers before upgrading the database.');
  }

  const missingRolls = sqliteQueryOne(
    'SELECT COUNT(*) AS count FROM students WHERE university_roll_number IS NULL OR TRIM(university_roll_number) = ?',
    ['']
  );
  if (missingRolls.count > 0) {
    throw new Error('Every student must have a university roll number before upgrading the student schema.');
  }

  sqlite.run('DROP TABLE IF EXISTS students_migrated');
  sqlite.run('BEGIN TRANSACTION');
  try {
    sqlite.run(`
      CREATE TABLE students_migrated (
        student_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        normalized_name TEXT,
        phone_lookup_hash TEXT,
        phone_last_four TEXT,
        university_roll_number TEXT NOT NULL UNIQUE,
        class_roll_number INTEGER,
        course TEXT NOT NULL,
        branch TEXT NOT NULL,
        year INTEGER NOT NULL,
        section TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    sqlite.run(`
      INSERT INTO students_migrated (
        student_id, name, normalized_name, phone_lookup_hash, phone_last_four,
        university_roll_number, class_roll_number,
        course, branch, year, section, created_at
      )
      SELECT student_id, name, UPPER(TRIM(name)), NULL, NULL, university_roll_number,
             ${hasClassRoll ? 'class_roll_number' : 'NULL'},
             course, branch, year, section, created_at
      FROM students
    `);
    sqlite.run('DROP TABLE students');
    sqlite.run('ALTER TABLE students_migrated RENAME TO students');
    sqlite.run('COMMIT');
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

function createSqliteSchema() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      normalized_name TEXT,
      phone_lookup_hash TEXT,
      phone_last_four TEXT,
      university_roll_number TEXT NOT NULL UNIQUE,
      class_roll_number INTEGER,
      course TEXT NOT NULL,
      branch TEXT NOT NULL,
      year INTEGER NOT NULL,
      section TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  migrateSqliteStudentsTable();
  const studentColumns = sqliteQueryAll('PRAGMA table_info(students)');
  if (!studentColumns.some((column) => column.name === 'normalized_name')) {
    sqlite.run('ALTER TABLE students ADD COLUMN normalized_name TEXT');
  }
  if (!studentColumns.some((column) => column.name === 'phone_lookup_hash')) {
    sqlite.run('ALTER TABLE students ADD COLUMN phone_lookup_hash TEXT');
  }
  if (!studentColumns.some((column) => column.name === 'phone_last_four')) {
    sqlite.run('ALTER TABLE students ADD COLUMN phone_last_four TEXT');
  }
  sqlite.run('UPDATE students SET normalized_name = UPPER(TRIM(name)) WHERE normalized_name IS NULL');
  sqlite.run('CREATE TABLE IF NOT EXISTS subjects (subject_id INTEGER PRIMARY KEY AUTOINCREMENT, subject_name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  sqlite.run('CREATE TABLE IF NOT EXISTS classrooms (classroom_id INTEGER PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL, subject TEXT NOT NULL, floor TEXT NOT NULL, wing TEXT NOT NULL, room TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  sqlite.run('CREATE TABLE IF NOT EXISTS admins (admin_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS timetable_entries (
      timetable_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_code TEXT,
      subject_name TEXT NOT NULL,
      session_type TEXT NOT NULL,
      faculty_code TEXT,
      faculty_name TEXT,
      room TEXT,
      academic_session TEXT NOT NULL,
      semester TEXT NOT NULL,
      source_label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (section, day_of_week, start_time, academic_session)
    )
  `);
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_students_university_roll ON students(university_roll_number)');
  sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_students_phone_lookup_hash ON students(phone_lookup_hash) WHERE phone_lookup_hash IS NOT NULL');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_students_identity ON students(normalized_name, phone_lookup_hash)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_students_section ON students(section)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_classrooms_section ON classrooms(section)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_timetable_section_day ON timetable_entries(section, day_of_week, start_time)');
}

async function createPostgresSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      student_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT,
      phone_lookup_hash TEXT,
      phone_last_four TEXT,
      university_roll_number TEXT NOT NULL UNIQUE,
      class_roll_number INTEGER,
      course TEXT NOT NULL,
      branch TEXT NOT NULL,
      year INTEGER NOT NULL,
      section TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE students ADD COLUMN IF NOT EXISTS normalized_name TEXT;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_lookup_hash TEXT;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_last_four TEXT;
    CREATE TABLE IF NOT EXISTS subjects (
      subject_id SERIAL PRIMARY KEY,
      subject_name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classrooms (
      classroom_id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      subject TEXT NOT NULL,
      floor TEXT NOT NULL,
      wing TEXT NOT NULL,
      room TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admins (
      admin_id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS timetable_entries (
      timetable_entry_id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_code TEXT,
      subject_name TEXT NOT NULL,
      session_type TEXT NOT NULL,
      faculty_code TEXT,
      faculty_name TEXT,
      room TEXT,
      academic_session TEXT NOT NULL,
      semester TEXT NOT NULL,
      source_label TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (section, day_of_week, start_time, academic_session)
    );
    CREATE INDEX IF NOT EXISTS idx_students_university_roll ON students(university_roll_number);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_phone_lookup_hash ON students(phone_lookup_hash) WHERE phone_lookup_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_students_identity ON students(normalized_name, phone_lookup_hash);
    CREATE INDEX IF NOT EXISTS idx_students_section ON students(section);
    CREATE INDEX IF NOT EXISTS idx_classrooms_section ON classrooms(section);
    CREATE INDEX IF NOT EXISTS idx_timetable_section_day ON timetable_entries(section, day_of_week, start_time);
  `);
}

function saveDatabase() {
  if (!sqlite) return;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(sqlite.export()));
}

function initDatabase() {
  if (dbReady) return dbReady;

  if (DATABASE_URL) {
    if (DATABASE_URL === 'pg-mem://test') {
      const { newDb } = require('pg-mem');
      const memoryDatabase = newDb();
      const adapter = memoryDatabase.adapters.createPg();
      pool = new adapter.Pool();
    } else {
      pool = new Pool({
        connectionString: DATABASE_URL,
        max: 8,
        connectionTimeoutMillis: 4000,
        idleTimeoutMillis: 30000,
        query_timeout: 5000,
        statement_timeout: 5000,
      });
    }
    dbReady = createPostgresSchema().then(() => {
      console.log('PostgreSQL database initialized successfully');
      return pool;
    });
    return dbReady;
  }

  dbReady = initSqlJs().then((SQL) => {
    sqlite = fs.existsSync(DB_PATH)
      ? new SQL.Database(fs.readFileSync(DB_PATH))
      : new SQL.Database();
    createSqliteSchema();
    saveDatabase();
    console.log('SQLite database initialized successfully');
    return sqlite;
  });
  return dbReady;
}

function getDatabase() {
  const database = pool || sqlite;
  if (!database) throw new Error('Database not initialized. Call initDatabase() first.');
  return database;
}

function postgresSql(sql) {
  let index = 0;
  return sql
    .replace(/\sLIKE\s/gi, ' ILIKE ')
    .replace(/\?/g, () => `$${++index}`);
}

async function queryAll(sql, params = []) {
  if (pool) return (await protectedPostgresQuery(pool, sql, params)).rows;
  return sqliteQueryAll(sql, params);
}

async function queryOne(sql, params = []) {
  return (await queryAll(sql, params))[0] || null;
}

async function execute(sql, params = []) {
  if (pool) {
    return postgresExecute(pool, sql, params);
  }

  sqlite.run(sql, params);
  const changes = sqlite.getRowsModified();
  const lastId = sqliteQueryOne('SELECT last_insert_rowid() as id');
  saveDatabase();
  return { changes, lastInsertRowid: lastId?.id || null };
}

function protectedPostgresQuery(executor, sql, params = []) {
  const operation = () => executor.query(postgresSql(sql), params);
  return DATABASE_URL === 'pg-mem://test' ? operation() : postgresCircuit.execute(operation);
}

async function postgresExecute(executor, sql, params = [], { returning = true } = {}) {
  const isInsert = /^\s*INSERT\s+/i.test(sql);
  const statement = returning && isInsert && !/\bRETURNING\b/i.test(sql)
    ? `${sql.trim().replace(/;$/, '')} RETURNING *`
    : sql;
  const result = await protectedPostgresQuery(executor, statement, params);
  const insertedRow = result.rows[0] || null;
  const idKey = insertedRow && Object.keys(insertedRow).find((key) => key.endsWith('_id'));
  return {
    changes: result.rowCount,
    lastInsertRowid: idKey ? insertedRow[idKey] : null,
  };
}

function validateIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return identifier;
}

async function insertManyWith(operations, table, columns, rows, { suffix = '', chunkSize = 200 } = {}) {
  if (!rows.length) return { changes: 0 };

  const safeTable = validateIdentifier(table);
  const safeColumns = columns.map(validateIdentifier);
  let changes = 0;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const placeholders = chunk
      .map(() => `(${safeColumns.map(() => '?').join(', ')})`)
      .join(', ');
    const sql = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES ${placeholders} ${suffix}`.trim();
    const result = await operations.execute(sql, chunk.flat(), { returning: false });
    changes += result.changes;
  }

  return { changes };
}

async function withTransaction(callback) {
  if (pool) {
    const client = await pool.connect();
    const operations = {
      queryAll: async (sql, params = []) => (await protectedPostgresQuery(client, sql, params)).rows,
      queryOne: async (sql, params = []) => (await operations.queryAll(sql, params))[0] || null,
      execute: (sql, params = [], options = {}) => postgresExecute(client, sql, params, options),
    };
    operations.insertMany = (table, columns, rows, options) => insertManyWith(operations, table, columns, rows, options);

    try {
      await client.query('BEGIN');
      const result = await callback(operations);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const operations = {
    queryAll: async (sql, params = []) => sqliteQueryAll(sql, params),
    queryOne: async (sql, params = []) => sqliteQueryOne(sql, params),
    execute: async (sql, params = []) => {
      sqlite.run(sql, params);
      return { changes: sqlite.getRowsModified(), lastInsertRowid: sqliteQueryOne('SELECT last_insert_rowid() AS id')?.id || null };
    },
  };
  operations.insertMany = (table, columns, rows, options) => insertManyWith(operations, table, columns, rows, options);

  sqlite.run('BEGIN TRANSACTION');
  try {
    const result = await callback(operations);
    sqlite.run('COMMIT');
    saveDatabase();
    return result;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

async function insertMany(table, columns, rows, options = {}) {
  return withTransaction((transaction) => transaction.insertMany(table, columns, rows, options));
}

function getDatabaseDependencyState() {
  return pool ? postgresCircuit.snapshot() : { state: 'local', failures: 0, active: 0 };
}

module.exports = {
  DB_PATH,
  initDatabase,
  getDatabase,
  saveDatabase,
  queryAll,
  queryOne,
  execute,
  insertMany,
  withTransaction,
  getDatabaseDependencyState,
};
