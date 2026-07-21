class CircuitOpenError extends Error {
  constructor(message = 'Dependency circuit is open.') {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'DEPENDENCY_CIRCUIT_OPEN';
  }
}

class DependencyBusyError extends Error {
  constructor(message = 'Dependency concurrency limit reached.') {
    super(message);
    this.name = 'DependencyBusyError';
    this.code = 'DEPENDENCY_BUSY';
  }
}

class DependencyTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Dependency timed out after ${timeoutMs}ms.`);
    this.name = 'DependencyTimeoutError';
    this.code = 'DEPENDENCY_TIMEOUT';
  }
}

class CircuitBreaker {
  constructor({
    failureThreshold = 3,
    resetTimeoutMs = 10000,
    timeoutMs = 6000,
    maxConcurrent = 8,
    isFailure = () => true,
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.timeoutMs = timeoutMs;
    this.maxConcurrent = maxConcurrent;
    this.isFailure = isFailure;
    this.failures = 0;
    this.openedAt = 0;
    this.state = 'closed';
    this.active = 0;
    this.probeInFlight = false;
  }

  reset() {
    this.failures = 0;
    this.openedAt = 0;
    this.state = 'closed';
    this.probeInFlight = false;
  }

  open() {
    this.state = 'open';
    this.openedAt = Date.now();
  }

  async execute(operation) {
    const now = Date.now();
    let isProbe = false;

    if (this.state === 'half-open') {
      throw new CircuitOpenError('Dependency recovery probe is already running.');
    }

    if (this.state === 'open') {
      if (now - this.openedAt < this.resetTimeoutMs || this.probeInFlight) {
        throw new CircuitOpenError();
      }
      this.state = 'half-open';
      this.probeInFlight = true;
      isProbe = true;
    }

    if (this.active >= this.maxConcurrent) {
      if (isProbe) {
        this.state = 'open';
        this.probeInFlight = false;
      }
      throw new DependencyBusyError();
    }

    this.active += 1;
    let timeout;

    try {
      const result = await Promise.race([
        Promise.resolve().then(operation),
        new Promise((resolve, reject) => {
          timeout = setTimeout(() => reject(new DependencyTimeoutError(this.timeoutMs)), this.timeoutMs);
        }),
      ]);
      this.reset();
      return result;
    } catch (error) {
      if (this.isFailure(error)) {
        this.failures += 1;
        if (isProbe || this.failures >= this.failureThreshold) this.open();
      } else if (isProbe) {
        this.reset();
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      this.active -= 1;
      if (isProbe && this.state !== 'open') this.probeInFlight = false;
    }
  }

  snapshot() {
    return {
      state: this.state,
      failures: this.failures,
      active: this.active,
    };
  }
}

module.exports = {
  CircuitBreaker,
  CircuitOpenError,
  DependencyBusyError,
  DependencyTimeoutError,
};
