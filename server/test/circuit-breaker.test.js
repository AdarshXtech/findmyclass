const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CircuitBreaker,
  CircuitOpenError,
  DependencyBusyError,
  DependencyTimeoutError,
} = require('../utils/circuit-breaker');

test('circuit breaker fast-fails, limits concurrency, and recovers with one probe', async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 20,
    timeoutMs: 15,
    maxConcurrent: 1,
    isFailure: (error) => error.code === 'DEPENDENCY_TIMEOUT' || error.message === 'offline',
  });

  await assert.rejects(() => breaker.execute(() => Promise.reject(new Error('offline'))), /offline/);
  await assert.rejects(() => breaker.execute(() => Promise.reject(new Error('offline'))), /offline/);
  assert.equal(breaker.snapshot().state, 'open');

  const fastFailStartedAt = Date.now();
  await assert.rejects(() => breaker.execute(() => Promise.resolve('unused')), CircuitOpenError);
  assert.ok(Date.now() - fastFailStartedAt < 10);

  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(await breaker.execute(() => Promise.resolve('recovered')), 'recovered');
  assert.deepEqual(breaker.snapshot(), { state: 'closed', failures: 0, active: 0 });

  let release;
  const activeRequest = breaker.execute(() => new Promise((resolve) => { release = resolve; }));
  await assert.rejects(() => breaker.execute(() => Promise.resolve('overflow')), DependencyBusyError);
  release('done');
  assert.equal(await activeRequest, 'done');

  await assert.rejects(
    () => breaker.execute(() => new Promise(() => {})),
    DependencyTimeoutError
  );
});
