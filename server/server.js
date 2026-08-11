const { loadEnvironment } = require('./config/env');

loadEnvironment();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { initDatabase, queryOne } = require('./config/db');
const logger = require('./utils/logger');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').trim();

if (TRUST_PROXY) {
  app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY === 'true');
}

function buildCorsOptions() {
  if (!CLIENT_ORIGIN) {
    return { origin: process.env.NODE_ENV === 'production' ? false : true };
  }

  const allowedOrigins = CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    }
  };
}

app.use(cors(buildCorsOptions()));
app.use(compression({ threshold: 1024 }));
app.use((req, res, next) => {
  req.requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  res.set('X-Request-Id', req.requestId);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '256kb' }));

app.use('/api/student', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/ready', async (req, res) => {
  try {
    await queryOne('SELECT 1 AS ready');
    res.json({ status: 'ready' });
  } catch (error) {
    logger.error('Database readiness check failed', { requestId: req.requestId, error: error.message });
    res.status(503).json({ status: 'not_ready' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  const corsDenied = err.message === 'Not allowed by CORS';
  logger.error('Unhandled request error', { requestId: req.requestId, error: err.message, stack: err.stack });
  res.status(corsDenied ? 403 : 500).json({
    success: false,
    message: corsDenied ? 'Origin is not allowed.' : 'Something went wrong. Please try again later.'
  });
});

async function startServer(port = PORT) {
  await initDatabase();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const activePort = typeof address === 'object' ? address.port : port;
      logger.info('API started', { port: activePort });
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

module.exports = { app, startServer };
