const path = require('path');

function loadEnvironment(envPath = path.join(__dirname, '..', '.env')) {
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('Node.js 20.12 or newer is required to load environment files.');
  }

  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = { loadEnvironment };

