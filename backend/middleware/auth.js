// SCRUM-5: verifies JWT, then checks the LIVE account before authorising every request.
// This stops inactive/suspended students from using an already-issued login token.
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const db = require('../config/db');
const userModel = require('../models/userModel');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { rows: revoked } = await db.query(
      'SELECT token_hash FROM revoked_tokens WHERE token_hash = $1', [tokenHash]
    );
    if (revoked.length) return res.status(401).json({ error: 'Session ended. Please log in again.' });
    const user = await userModel.findById(payload.id);
    if (!user || (user.role === 'student' && user.membership_status !== 'active')) {
      return res.status(401).json({ error: 'Your account is unavailable. Please contact headquarters.' });
    }
    req.user = { id: user.id, name: user.name, role: user.role };
    req.authToken = token;
    req.tokenExpiry = payload.exp;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
