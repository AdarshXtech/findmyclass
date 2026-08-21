const { normalizeSection, parseCsaiSection } = require('../utils/validation');

const SECTION_TABLES = [
  'students',
  'classrooms',
  'timetable_entries',
  'timetable_seed_state',
  'faculty_contacts',
  'section_coordinators',
];

async function aliases(database) {
  const values = new Set();
  for (const table of SECTION_TABLES) {
    for (const row of await database.queryAll(`SELECT DISTINCT section FROM ${table}`)) {
      if (row.section) values.add(row.section);
    }
  }
  return [...values].filter((section) => normalizeSection(section) !== section);
}

async function mergeTimetable(database, source, target) {
  const rows = await database.queryAll(
    `SELECT day_of_week, start_time, end_time, subject_code, subject_name, session_type,
            faculty_code, faculty_name, room, academic_session, semester, source_label, notes, faculty_id
     FROM timetable_entries WHERE section = ?`,
    [source]
  );
  if (rows.length) {
    await database.insertMany(
      'timetable_entries',
      ['section', 'day_of_week', 'start_time', 'end_time', 'subject_code', 'subject_name', 'session_type',
        'faculty_code', 'faculty_name', 'room', 'academic_session', 'semester', 'source_label', 'notes', 'faculty_id'],
      rows.map((row) => [
        target, row.day_of_week, row.start_time, row.end_time, row.subject_code, row.subject_name,
        row.session_type, row.faculty_code, row.faculty_name, row.room, row.academic_session,
        row.semester, row.source_label, row.notes, row.faculty_id,
      ]),
      { suffix: 'ON CONFLICT (section, day_of_week, start_time, academic_session) DO NOTHING' }
    );
    await database.execute('DELETE FROM timetable_entries WHERE section = ?', [source]);
  }
}

async function mergeSeedState(database, source, target) {
  const rows = await database.queryAll(
    'SELECT academic_session FROM timetable_seed_state WHERE section = ?',
    [source]
  );
  if (rows.length) {
    await database.insertMany(
      'timetable_seed_state',
      ['section', 'academic_session'],
      rows.map((row) => [target, row.academic_session]),
      { suffix: 'ON CONFLICT (section, academic_session) DO NOTHING' }
    );
    await database.execute('DELETE FROM timetable_seed_state WHERE section = ?', [source]);
  }
}

async function mergeCoordinator(database, source, target) {
  const sourceCoordinator = await database.queryOne(
    'SELECT faculty_id FROM section_coordinators WHERE section = ?',
    [source]
  );
  if (!sourceCoordinator) return;
  await database.execute(
    `INSERT INTO section_coordinators (section, faculty_id)
     VALUES (?, ?) ON CONFLICT (section) DO NOTHING`,
    [target, sourceCoordinator.faculty_id]
  );
  await database.execute('DELETE FROM section_coordinators WHERE section = ?', [source]);
}

async function mergeLegacyContacts(database, source, target) {
  const targetCoordinator = await database.queryOne(
    "SELECT faculty_contact_id FROM faculty_contacts WHERE section = ? AND role = 'Coordinator'",
    [target]
  );
  if (targetCoordinator) {
    await database.execute(
      "DELETE FROM faculty_contacts WHERE section = ? AND role = 'Coordinator'",
      [source]
    );
  }
  await database.execute('UPDATE faculty_contacts SET section = ? WHERE section = ?', [target, source]);
}

async function up(database) {
  for (const source of await aliases(database)) {
    const target = normalizeSection(source);
    const identity = parseCsaiSection(target);
    if (!identity) continue;

    await mergeTimetable(database, source, target);
    await mergeSeedState(database, source, target);
    await mergeCoordinator(database, source, target);
    await mergeLegacyContacts(database, source, target);
    await database.execute('UPDATE classrooms SET section = ? WHERE section = ?', [target, source]);
    await database.execute(
      'UPDATE students SET section = ?, branch = ?, year = ? WHERE section = ?',
      [target, identity.branch, identity.year, source]
    );
  }

  const sections = await database.queryAll("SELECT DISTINCT section FROM students WHERE section LIKE 'CSAI%'");
  for (const row of sections) {
    const identity = parseCsaiSection(row.section);
    if (identity) {
      await database.execute(
        'UPDATE students SET branch = ?, year = ? WHERE section = ?',
        [identity.branch, identity.year, identity.section]
      );
    }
  }
}

module.exports = { id: '002-normalize-csai-sections', up };
