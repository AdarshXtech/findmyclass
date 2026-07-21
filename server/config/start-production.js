const { loadEnvironment } = require('./env');

loadEnvironment();

const { loadCsai2b } = require('./load-csai2b');
const { startServer } = require('../server');

async function startProduction() {
  await loadCsai2b();
  await startServer();
}

startProduction().catch((error) => {
  console.error('Failed to start production server:', error);
  process.exit(1);
});
