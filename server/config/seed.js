const bcrypt = require('bcryptjs');
const { initDatabase, getDatabase, execute, queryAll, queryOne } = require('./db');

async function seedDatabase() {
  await initDatabase();
  const db = getDatabase();

  // ── Clear existing data ──────────────────────────────────
  db.run('DELETE FROM classrooms');
  db.run('DELETE FROM subjects');
  db.run('DELETE FROM students');
  db.run('DELETE FROM admins');
  console.log('🗑️  Cleared existing data');

  // ── Seed Admin ───────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  execute('INSERT INTO admins (username, password) VALUES (?, ?)', [
    'admin', hashedPassword
  ]);
  console.log('👤 Admin seeded: admin / admin123');

  // ── Seed Students ────────────────────────────────────────
  const students = [
    ['Adarsh Tiwari',   '9876543210', 'B.Tech', 'CSE', 1, 'CSE-A'],
    ['Priya Sharma',    '9876543211', 'B.Tech', 'CSE', 1, 'CSE-A'],
    ['Rahul Kumar',     '9876543212', 'B.Tech', 'CSE', 1, 'CSE-A'],
    ['Ananya Das',      '9876543213', 'B.Tech', 'CSE', 1, 'CSE-A'],
    ['Vikash Yadav',    '9876543214', 'B.Tech', 'CSE', 1, 'CSE-A'],
    ['Sneha Gupta',     '9876543215', 'B.Tech', 'CSE', 1, 'CSE-B'],
    ['Amit Singh',      '9876543216', 'B.Tech', 'CSE', 1, 'CSE-B'],
    ['Pooja Mehra',     '9876543217', 'B.Tech', 'CSE', 1, 'CSE-B'],
    ['Neha Verma',      '9876543218', 'B.Tech', 'ECE', 1, 'ECE-A'],
    ['Vikram Joshi',    '9876543219', 'B.Tech', 'ECE', 1, 'ECE-A'],
    ['Kavita Patel',    '9876543220', 'B.Tech', 'ME',  1, 'ME-A'],
    ['Rohit Mishra',    '9876543221', 'B.Tech', 'ME',  1, 'ME-A'],
  ];

  for (const s of students) {
    execute(
      'INSERT INTO students (name, phone, course, branch, year, section) VALUES (?, ?, ?, ?, ?, ?)',
      s
    );
  }
  console.log(`📚 Seeded ${students.length} students`);

  // ── Seed Subjects ────────────────────────────────────────
  const subjects = [
    'Mathematics', 'Physics', 'English', 'Programming Lab',
    'Chemistry Lab', 'Engineering Drawing', 'Communication Skills',
    'Basic Electrical Engineering', 'Data Structures', 'Digital Electronics',
  ];

  for (const s of subjects) {
    execute('INSERT INTO subjects (subject_name) VALUES (?)', [s]);
  }
  console.log(`📖 Seeded ${subjects.length} subjects`);

  // ── Seed Classroom Assignments ───────────────────────────
  const classrooms = [
    // CSE-A
    ['CSE-A', 'Mathematics',     '3rd Floor', 'B', '305'],
    ['CSE-A', 'Physics',         '2nd Floor', 'A', '210'],
    ['CSE-A', 'English',         '1st Floor', 'C', '108'],
    ['CSE-A', 'Programming Lab', '5th Floor', 'C', 'Lab-501'],
    ['CSE-A', 'Chemistry Lab',   '4th Floor', 'A', 'Lab-401'],
    // CSE-B
    ['CSE-B', 'Mathematics',     '3rd Floor', 'B', '306'],
    ['CSE-B', 'Physics',         '2nd Floor', 'A', '211'],
    ['CSE-B', 'English',         '1st Floor', 'C', '109'],
    ['CSE-B', 'Programming Lab', '5th Floor', 'C', 'Lab-502'],
    ['CSE-B', 'Chemistry Lab',   '4th Floor', 'A', 'Lab-402'],
    // ECE-A
    ['ECE-A', 'Mathematics',               '3rd Floor', 'A', '301'],
    ['ECE-A', 'Physics',                   '2nd Floor', 'B', '212'],
    ['ECE-A', 'English',                   '1st Floor', 'C', '110'],
    ['ECE-A', 'Engineering Drawing',       '6th Floor', 'B', '601'],
    ['ECE-A', 'Basic Electrical Engineering','4th Floor','C', '403'],
    // ME-A
    ['ME-A', 'Mathematics',          '3rd Floor', 'C', '310'],
    ['ME-A', 'Physics',              '2nd Floor', 'B', '215'],
    ['ME-A', 'English',              '1st Floor', 'A', '105'],
    ['ME-A', 'Engineering Drawing',  '6th Floor', 'A', '602'],
    ['ME-A', 'Communication Skills', '1st Floor', 'B', '115'],
  ];

  for (const c of classrooms) {
    execute(
      'INSERT INTO classrooms (section, subject, floor, wing, room) VALUES (?, ?, ?, ?, ?)',
      c
    );
  }
  console.log(`🏫 Seeded ${classrooms.length} classroom assignments`);

  // ── Summary ──────────────────────────────────────────────
  console.log('\n✅ Database seeded successfully!');
  console.log('─────────────────────────────────────');
  console.log('Admin credentials : admin / admin123');
  console.log('Sample phones     : 9876543210 – 9876543221');
  console.log('Sections          : CSE-A, CSE-B, ECE-A, ME-A');
  console.log('─────────────────────────────────────\n');
}

seedDatabase().catch(console.error);
