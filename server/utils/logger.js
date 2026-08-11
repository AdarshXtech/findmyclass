function write(level, message, details = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...details };
  const output = process.env.NODE_ENV === 'production' ? JSON.stringify(entry) : `${level.toUpperCase()}: ${message}`;
  (level === 'error' ? console.error : console.log)(output);
}

module.exports = {
  error: (message, details) => write('error', message, details),
  info: (message, details) => write('info', message, details),
  warn: (message, details) => write('warn', message, details),
};
