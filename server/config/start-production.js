const { loadEnvironment } = require('./env');

loadEnvironment();

const { loadScheduleData } = require('./load-schedule-data');
const { startServer } = require('../server');

async function startProduction() {
  await loadScheduleData();
  await startServer();
}

startProduction().catch((error) => {
  console.error('Failed to start production server:', error);
  process.exit(1);
});
