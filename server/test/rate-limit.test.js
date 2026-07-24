const test = require('node:test');
const assert = require('node:assert/strict');
const { FailedAttemptLimiter } = require('../middleware/rate-limit');

function request(ip) {
  return { ip };
}

function response() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test('blocks repeated failures, provides retry timing, and clears after success', () => {
  const limiter = new FailedAttemptLimiter({
    windowMs: 1000,
    maxAttempts: 2,
    message: 'Try later.',
  });
  const req = request('203.0.113.10');

  limiter.recordFailure(req);
  assert.equal(limiter.check(req, response()), false);
  limiter.recordFailure(req);

  const blocked = response();
  assert.equal(limiter.check(req, blocked), true);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.message, 'Try later.');
  assert.match(blocked.headers['Retry-After'], /^\d+$/);

  limiter.clear(req);
  assert.equal(limiter.check(req, response()), false);
});

test('keeps the attempt map within its configured capacity', () => {
  const limiter = new FailedAttemptLimiter({
    windowMs: 1000,
    maxAttempts: 2,
    maxEntries: 2,
  });

  limiter.recordFailure(request('203.0.113.1'));
  limiter.recordFailure(request('203.0.113.2'));
  limiter.recordFailure(request('203.0.113.3'));

  assert.equal(limiter.attempts.size, 2);
  assert.equal(limiter.attempts.has('203.0.113.1'), false);
});
