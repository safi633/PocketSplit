const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'expense-tracker-development-jwt-secret';

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is missing in .env; using the development secret.');
}

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired login session' });
  }
};

const requireSameUser = (req, res, next) => {
  if (String(req.user.id) !== String(req.params.userId || req.params.id)) {
    return res.status(403).json({ error: 'You are not allowed to access this data' });
  }

  next();
};

module.exports = {
  JWT_SECRET,
  requireAuth,
  requireSameUser,
};
