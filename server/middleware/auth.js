const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? 'dev-only-jwt-secret-change-me' : '');

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Expects: Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
}

module.exports = { authenticateToken, JWT_SECRET };
