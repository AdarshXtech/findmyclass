const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionEnvironment } = require('../config/validate-production');

test('accepts a production configuration with separate strong secrets', () => {
  assert.deepEqual(validateProductionEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app@example.invalid/findmyclass',
    JWT_SECRET: 'j'.repeat(32),
    PHONE_LOOKUP_SECRET: 'p'.repeat(32),
    CLIENT_ORIGIN: 'https://findmyclass.example.edu',
    ENABLE_TEST_LOGIN: 'false',
  }), []);
});

test('rejects demo access, weak secrets, and non-HTTPS production origins', () => {
  const errors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: './database.sqlite',
    JWT_SECRET: 'same',
    PHONE_LOOKUP_SECRET: 'same',
    CLIENT_ORIGIN: 'http://localhost:3000',
    ENABLE_TEST_LOGIN: 'true',
  });
  assert.ok(errors.length >= 5);
});
