const database = require('../config/db');
const { cleanFacultyName, normalizeFacultyName } = require('../utils/faculty-identity');

function db(operations) {
  return operations || database;
}

async function syncTimetableFaculty(section, operations) {
  const store = db(operations);
  const params = [];
  let where = "faculty_name IS NOT NULL AND faculty_name <> ''";
  if (section) {
    where += ' AND section = ?';
    params.push(section);
  }
  const names = await store.queryAll(`SELECT DISTINCT faculty_name FROM timetable_entries WHERE ${where}`, params);

  for (const item of names) {
    const name = cleanFacultyName(item.faculty_name);
    const normalizedName = normalizeFacultyName(name);
    if (!normalizedName) continue;
    await store.execute(
      `INSERT INTO faculty (name, normalized_name)
       VALUES (?, ?) ON CONFLICT (normalized_name) DO NOTHING`,
      [name, normalizedName]
    );
    const faculty = await store.queryOne('SELECT faculty_id FROM faculty WHERE normalized_name = ?', [normalizedName]);
    await store.execute(
      'UPDATE timetable_entries SET faculty_id=? WHERE faculty_name=? AND faculty_id IS NULL',
      [faculty.faculty_id, item.faculty_name]
    );
  }
}

async function findById(id, operations) {
  return db(operations).queryOne('SELECT * FROM faculty WHERE faculty_id = ?', [id]);
}

async function findByNormalizedName(normalizedName, operations) {
  return db(operations).queryOne('SELECT * FROM faculty WHERE normalized_name = ?', [normalizedName]);
}

async function saveContact(values, operations) {
  const store = db(operations);
  const normalizedName = normalizeFacultyName(values.name);
  const current = values.id
    ? await findById(values.id, store)
    : await findByNormalizedName(normalizedName, store);

  if (current) {
    await store.execute(
      `UPDATE faculty SET name=?, normalized_name=?, phone_number=?, designation=?, department=?,
       is_active=?, updated_at=CURRENT_TIMESTAMP WHERE faculty_id=?`,
      [values.name, normalizedName, values.phoneNumber, values.designation, values.department, values.isActive, current.faculty_id]
    );
    return current.faculty_id;
  }

  const result = await store.execute(
    `INSERT INTO faculty (name, normalized_name, phone_number, designation, department, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [values.name, normalizedName, values.phoneNumber, values.designation, values.department, values.isActive]
  );
  return result.lastInsertRowid;
}

async function setCoordinator(section, facultyId, operations) {
  return db(operations).execute(
    `INSERT INTO section_coordinators (section, faculty_id) VALUES (?, ?)
     ON CONFLICT (section) DO UPDATE SET faculty_id=excluded.faculty_id, updated_at=CURRENT_TIMESTAMP`,
    [section, facultyId]
  );
}

async function getCoordinator(section, operations) {
  return db(operations).queryOne(
    `SELECT f.* FROM section_coordinators sc
     JOIN faculty f ON f.faculty_id = sc.faculty_id WHERE sc.section = ?`,
    [section]
  );
}

async function clearCoordinator(section, facultyId, operations) {
  const params = facultyId ? [section, facultyId] : [section];
  return db(operations).execute(
    `DELETE FROM section_coordinators WHERE section = ?${facultyId ? ' AND faculty_id = ?' : ''}`,
    params
  );
}

async function getSectionFaculty(section, operations) {
  const store = db(operations);
  const taught = await store.queryAll(
    `SELECT DISTINCT faculty_id, faculty_name FROM timetable_entries
     WHERE section = ? AND faculty_name IS NOT NULL AND faculty_name <> ''
     ORDER BY faculty_name`,
    [section]
  );
  const coordinator = await store.queryOne(
    `SELECT f.* FROM section_coordinators sc
     JOIN faculty f ON f.faculty_id = sc.faculty_id
     WHERE sc.section = ?`,
    [section]
  );
  const directory = await store.queryAll('SELECT * FROM faculty WHERE is_active = TRUE ORDER BY name');
  const byId = new Map(directory.map((item) => [Number(item.faculty_id), item]));
  const byName = new Map(directory.map((item) => [item.normalized_name, item]));
  const seen = new Set();
  const faculty = [];

  for (const item of taught) {
    const record = byId.get(Number(item.faculty_id)) || byName.get(normalizeFacultyName(item.faculty_name));
    const key = record ? `id:${record.faculty_id}` : `name:${normalizeFacultyName(item.faculty_name)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    faculty.push(record || {
      faculty_id: null,
      name: cleanFacultyName(item.faculty_name),
      phone_number: null,
      designation: null,
      department: null,
    });
  }

  return { coordinator, faculty };
}

async function listDirectory(operations) {
  const store = db(operations);
  const [faculty, classes] = await Promise.all([
    store.queryAll('SELECT * FROM faculty ORDER BY name'),
    store.queryAll(
      `SELECT faculty_id, COUNT(DISTINCT section) AS class_count
       FROM timetable_entries WHERE faculty_id IS NOT NULL GROUP BY faculty_id`
    ),
  ]);
  const counts = new Map(classes.map((item) => [Number(item.faculty_id), Number(item.class_count)]));
  return faculty.map((item) => ({ ...item, class_count: counts.get(Number(item.faculty_id)) || 0 }));
}

module.exports = {
  clearCoordinator,
  findById,
  findByNormalizedName,
  getSectionFaculty,
  getCoordinator,
  listDirectory,
  saveContact,
  setCoordinator,
  syncTimetableFaculty,
};
