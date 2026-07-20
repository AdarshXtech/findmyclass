const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/db');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';

function buildCorsOptions() {
  if (!CLIENT_ORIGIN) {
    return { origin: true };
  }

  const allowedOrigins = CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    }
  };
}

// ── Middleware ──────────────────────────────────────────────
app.use(cors(buildCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Smart Classroom Locator API is running',
    timestamp: new Date().toISOString()
  });
});

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.'
  });
});

// ── Initialize DB then Start Server ────────────────────────
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Smart Classroom Locator API`);
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
