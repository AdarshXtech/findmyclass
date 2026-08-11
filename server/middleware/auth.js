const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? 'dev-only-jwt-secret-change-me' : '');
const ADMIN_SESSION_COOKIE = 'findmyclass_admin_session';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Expects: Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
  const token = bearerToken || cookies[ADMIN_SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!bearerToken && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfToken = String(req.headers['x-csrf-token'] || '');
      if (!decoded.csrf || csrfToken !== decoded.csrf) {
        return res.status(403).json({ success: false, message: 'Invalid request token.' });
      }
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
}

function adminCookieOptions({ clear = false } = {}) {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/admin',
  };
  if (!clear) options.maxAge = 24 * 60 * 60 * 1000;
  return options;
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role || 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { ADMIN_SESSION_COOKIE, adminCookieOptions, authenticateToken, authorizeRoles, JWT_SECRET };
