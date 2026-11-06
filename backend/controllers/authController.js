// AUTH - CONTROLLER: register, login, who-am-i.
// Public registration always creates a STUDENT account. The admin account comes from `npm run db:setup`.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

  const user = await userModel.findByEmail(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: makeToken(user), user: publicUser(user) });
}

// GET /api/auth/me   (needs login)
async function me(req, res) {
  const user = await userModel.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  res.json(publicUser(user));
}

module.exports = { register, login, me };
