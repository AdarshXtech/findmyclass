const { cleanFacultyName, normalizeFacultyName } = require('../utils/faculty-identity');

async function hasColumn(database, dialect, table, column) {
  if (dialect === 'postgres') {
    return Boolean(await database.queryOne(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
      [table, column]
    ));
  }
  return (await database.queryAll(`PRAGMA table_info(${table})`)).some((item) => item.name === column);
}

async function addColumn(database, dialect, table, column, definition) {
  if (!await hasColumn(database, dialect, table, column)) {
    await database.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function up(database, dialect) {
  const id = dialect === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const timestamp = dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';
  const boolean = dialect === 'postgres' ? 'BOOLEAN' : 'INTEGER';

  await database.execute(`
    CREATE TABLE IF NOT EXISTS faculty (
      faculty_id ${id},
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      phone_number TEXT,
      designation TEXT,
      department TEXT,
      is_active ${boolean} NOT NULL DEFAULT ${dialect === 'postgres' ? 'TRUE' : '1'},
      created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.execute(`
    CREATE TABLE IF NOT EXISTS section_coordinators (
      section TEXT PRIMARY KEY,
      faculty_id INTEGER NOT NULL REFERENCES faculty(faculty_id),
      created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.execute(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      audit_id ${id},
      admin_id INTEGER REFERENCES admins(admin_id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await addColumn(database, dialect, 'timetable_entries', 'faculty_id', 'INTEGER REFERENCES faculty(faculty_id)');
  await addColumn(database, dialect, 'admins', 'role', "TEXT NOT NULL DEFAULT 'SUPER_ADMIN'");
  await database.execute('CREATE INDEX IF NOT EXISTS idx_faculty_normalized_name ON faculty(normalized_name)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_timetable_faculty_id ON timetable_entries(faculty_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at)');

  const timetableNames = await database.queryAll(
    `SELECT DISTINCT faculty_name FROM timetable_entries
     WHERE faculty_name IS NOT NULL AND faculty_name <> ''`
  );
  const legacyContacts = await database.queryAll('SELECT * FROM faculty_contacts ORDER BY faculty_contact_id');

  for (const source of [...timetableNames, ...legacyContacts]) {
    const name = cleanFacultyName(source.faculty_name || source.name);
    const normalizedName = normalizeFacultyName(name);
    if (!normalizedName) continue;
    await database.execute(
      `INSERT INTO faculty (name, normalized_name, phone_number, designation)
       VALUES (?, ?, ?, ?) ON CONFLICT (normalized_name) DO NOTHING`,
      [name, normalizedName, source.phone_number || null, source.designation || null]
    );
    if (source.phone_number) {
      await database.execute(
        `UPDATE faculty SET phone_number=?, designation=?, updated_at=CURRENT_TIMESTAMP
         WHERE normalized_name=?`,
        [source.phone_number, source.designation || null, normalizedName]
      );
    }
  }

  const facultyRows = await database.queryAll('SELECT faculty_id, normalized_name FROM faculty');
  const facultyByName = new Map(facultyRows.map((item) => [item.normalized_name, item.faculty_id]));
  for (const contact of legacyContacts) {
    if (contact.role !== 'Coordinator') continue;
    const facultyId = facultyByName.get(normalizeFacultyName(contact.name));
    if (!facultyId) continue;
    await database.execute(
      `INSERT INTO section_coordinators (section, faculty_id)
       VALUES (?, ?) ON CONFLICT (section) DO UPDATE SET faculty_id=excluded.faculty_id, updated_at=CURRENT_TIMESTAMP`,
      [contact.section, facultyId]
    );
  }
  for (const item of timetableNames) {
    const normalizedName = normalizeFacultyName(item.faculty_name);
    const facultyId = facultyByName.get(normalizedName);
    if (facultyId) {
      await database.execute(
        'UPDATE timetable_entries SET faculty_id=? WHERE faculty_name=?',
        [facultyId, item.faculty_name]
      );
    }
  }
}

module.exports = { id: '001-production-foundation', up };
