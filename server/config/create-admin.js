const { loadEnvironment } = require('./env');

loadEnvironment();

const bcrypt = require('bcryptjs');
const { initDatabase, execute, queryOne } = require('./db');

async function createAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!username) {
    throw new Error('ADMIN_USERNAME is required.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  await initDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await queryOne('SELECT admin_id FROM admins WHERE username = ?', [username]);

  if (existing) {
    await execute('UPDATE admins SET password = ? WHERE admin_id = ?', [passwordHash, existing.admin_id]);
    console.log(`Updated admin account: ${username}`);
    return;
  }

  await execute('INSERT INTO admins (username, password) VALUES (?, ?)', [username, passwordHash]);
  console.log(`Created admin account: ${username}`);
}

createAdmin().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
