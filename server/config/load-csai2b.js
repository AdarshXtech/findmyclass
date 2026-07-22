const { loadScheduleData } = require('./load-schedule-data');

async function loadCsai2b() {
  return loadScheduleData();
}

if (require.main === module) {
  loadCsai2b().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { loadCsai2b };
