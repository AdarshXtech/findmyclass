const { loadEnvironment } = require('./env');

loadEnvironment();

const { loadScheduleData } = require('./load-schedule-data');
const { initDatabase } = require('./db');
const { startServer } = require('../server');

async function startProduction() {
  if (process.env.LOAD_BUNDLED_DATA === 'true') await loadScheduleData();
  else await initDatabase();
  const server = await startServer();
  const shutdown = (signal) => {
    console.log(`${signal} received. Closing HTTP server.`);
    server.close((error) => process.exit(error ? 1 : 0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

startProduction().catch((error) => {
  console.error('Failed to start production server:', error);
  process.exit(1);
});
