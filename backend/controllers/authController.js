// AUTH - CONTROLLER: register, login, who-am-i.
// Public registration always creates a STUDENT account. The admin account comes from `npm run db:setup`.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const db = require('../config/db');
const userModel = require('../models/userModel');

function makeToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// POST /api/auth/register   { name, email, password }
async function register(req, res) {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (await userModel.findByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await userModel.createStudentAccount(name, email, hash);
  res.status(201).json({ token: makeToken(user), user: publicUser(user) });
}

// POST /api/auth/login   { email, password }
async function login(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const requestedRole = req.body.role; // optional for older clients

  if (!email || !password || (requestedRole && !['admin', 'student'].includes(requestedRole))) {
    return res.status(400).json({ error: 'Enter valid login details.' });
  }

  const user = await userModel.findByEmail(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok || (requestedRole && user.role !== requestedRole)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (user.role === 'student' && user.membership_status !== 'active') {
    return res.status(403).json({ error: 'Your account is unavailable. Please contact headquarters.' });
  }
  res.json({ token: makeToken(user), user: publicUser(user) });
}

// GET /api/auth/me   (needs login)
async function me(req, res) {
  const user = await userModel.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  res.json(publicUser(user));
}

// POST /api/auth/logout: invalidate the exact JWT on the server.
async function logout(req, res, next) {
  try {
    const tokenHash = createHash('sha256').update(req.authToken).digest('hex');
    const expiresAt = new Date((req.tokenExpiry || Math.floor(Date.now() / 1000) + 604800) * 1000).toISOString();
    await db.query(
      `INSERT INTO revoked_tokens (token_hash, expires_at)
       VALUES ($1, $2::timestamptz) ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, expiresAt]
    );
    res.json({ message: 'Logged out.' });
  } catch (err) { next(err); }
}

module.exports = { register, login, me, logout };
