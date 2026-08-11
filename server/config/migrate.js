const { loadEnvironment } = require('./env');

loadEnvironment();

const { initDatabase } = require('./db');

initDatabase()
  .then(() => console.log('Database migrations are up to date.'))
  .catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exit(1);
  });
