const model = require('../models/gradingSessionModel');

const TYPES = ['mass_adult', 'mass_children', 'private'];

function httpError(status, message) {
  return Object.assign(new Error(message), { status: status });
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e.code === '23503') return res.status(400).json({ error: 'That centre does not exist.' });
      if (e.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  };
}

// POST /api/grading-sessions
const createSession = handle(async (req, res) => {
  const b = req.body;

  const required = ['type', 'centre_id', 'venue', 'session_date', 'session_time', 'fee', 'apply_open', 'apply_close'];
  for (const f of required) {
    if (b[f] === undefined || b[f] === null || b[f] === '') throw httpError(400, f + ' is required.');
  }
  if (!TYPES.includes(b.type)) throw httpError(400, 'Type must be mass_adult, mass_children or private.');
  if (isNaN(Number(b.fee)) || Number(b.fee) < 0) throw httpError(400, 'Fee must be 0 or more.');

  // application window must make sense and close before the session starts
  const open = new Date(b.apply_open);
  const close = new Date(b.apply_close);
  if (isNaN(open) || isNaN(close) || open >= close) throw httpError(400, 'The application window is invalid.');
  if (close > new Date(b.session_date + 'T' + b.session_time)) {
    throw httpError(400, 'Applications must close before the session starts.');
  }

  // capacity: mass needs one, private is capped at 4
  let capacity = Number(b.capacity);
  if (b.type === 'private') {
    capacity = capacity || 4;
    if (capacity > 4) throw httpError(400, 'A private grading is capped at 4 students.');
  } else if (!capacity || capacity < 1) {
    throw httpError(400, 'A mass grading needs a capacity.');
  }

  const session = await model.createSession({ ...b, capacity: capacity });
  res.status(201).json(session);
});

// GET /api/grading-sessions
const listSessions = handle(async (req, res) => {
  res.json(await model.listSessions());
});

module.exports = { createSession, listSessions };