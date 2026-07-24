class FailedAttemptLimiter {
  constructor({
    windowMs,
    maxAttempts,
    maxEntries = 5000,
    message = 'Too many unsuccessful attempts. Please try again later.',
  }) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.maxEntries = maxEntries;
    this.message = message;
    this.attempts = new Map();
  }

  keyFor(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  current(key) {
    const attempt = this.attempts.get(key);
    if (attempt && attempt.resetAt > Date.now()) return attempt;
    this.attempts.delete(key);
    return null;
  }

  prune() {
    const now = Date.now();
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetAt <= now) this.attempts.delete(key);
    }

    while (this.attempts.size >= this.maxEntries) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey === undefined) break;
      this.attempts.delete(oldestKey);
    }
  }

  check(req, res) {
    const attempt = this.current(this.keyFor(req));
    if (!attempt || attempt.count < this.maxAttempts) return false;

    const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ success: false, message: this.message });
    return true;
  }

  recordFailure(req) {
    const key = this.keyFor(req);
    const current = this.current(key);
    if (!current && this.attempts.size >= this.maxEntries) this.prune();

    this.attempts.delete(key);
    this.attempts.set(key, {
      count: (current?.count || 0) + 1,
      resetAt: current?.resetAt || Date.now() + this.windowMs,
    });
  }

  clear(req) {
    this.attempts.delete(this.keyFor(req));
  }

  reset() {
    this.attempts.clear();
  }
}

function createFailedAttemptLimiter(options) {
  return new FailedAttemptLimiter(options);
}

module.exports = { FailedAttemptLimiter, createFailedAttemptLimiter };
