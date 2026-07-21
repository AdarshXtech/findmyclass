const { loadEnvironment } = require('./config/env');

loadEnvironment();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabaseDependencyState } = require('./config/db');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';

function buildCorsOptions() {
  if (!CLIENT_ORIGIN) {
    return { origin: process.env.NODE_ENV === 'production' ? false : true };
  }

  const allowedOrigins = CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Smart Classroom Locator API is running',
    timestamp: new Date().toISOString(),
    database: getDatabaseDependencyState()
  });
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
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.'
  });
});

async function startServer(port = PORT) {
  await initDatabase();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const activePort = typeof address === 'object' ? address.port : port;
      console.log(`Smart Classroom Locator API running on http://localhost:${activePort}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
