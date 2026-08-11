const { loadEnvironment } = require('./env');

loadEnvironment();

function validateProductionEnvironment(environment = process.env) {
  const errors = [];
  if (environment.NODE_ENV !== 'production') errors.push('NODE_ENV must be production.');
  if (!String(environment.DATABASE_URL || '').startsWith('postgres')) errors.push('DATABASE_URL must be a PostgreSQL connection string.');
  if (String(environment.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET must contain at least 32 characters.');
  if (String(environment.PHONE_LOOKUP_SECRET || '').length < 32) errors.push('PHONE_LOOKUP_SECRET must contain at least 32 characters.');
  if (environment.JWT_SECRET && environment.JWT_SECRET === environment.PHONE_LOOKUP_SECRET) errors.push('JWT_SECRET and PHONE_LOOKUP_SECRET must be different.');
  const origins = String(environment.CLIENT_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => !origin.startsWith('https://'))) errors.push('CLIENT_ORIGIN must contain HTTPS origins only.');
  if (environment.ENABLE_TEST_LOGIN === 'true') errors.push('ENABLE_TEST_LOGIN must be false in production.');
  return errors;
}

if (require.main === module) {
  const errors = validateProductionEnvironment();
  if (errors.length) {
    console.error(`Production configuration is invalid:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Production configuration is valid.');
}

module.exports = { validateProductionEnvironment };
