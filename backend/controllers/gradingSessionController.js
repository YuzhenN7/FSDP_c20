const model = require('../models/gradingSessionModel');

const TYPES = ['mass_adult', 'mass_children', 'private'];
const MIN_MONTHS_BETWEEN_GRADINGS = 3;
const ADULT_MIN_AGE = 13; 

function httpError(status, message, reasons) {
  return Object.assign(new Error(message), { status: status, reasons: reasons });
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e.code === '23503') return res.status(400).json({ error: 'That centre does not exist.' });
      if (e.status) return res.status(e.status).json({ error: e.message, reasons: e.reasons });
      throw e;
    }
  };
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Invalid id.');
  return id;
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


function inWindow(session) {
  const now = new Date();
  return now >= new Date(session.apply_open) && now <= new Date(session.apply_close);
}

// 'YYYY-MM-DD'
function ageOn(dob, day) {
  const b = new Date(dob + 'T00:00:00');
  const d = new Date(day + 'T00:00:00');
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

// Eligibility rules
function checkEligibility(st, session) {
  const reasons = [];

  // Needs a current belt, and a higher belt to grade for
  if (!st.belt_id) reasons.push('No current belt is recorded for you.');
  else if (!st.next_belt_id) reasons.push('You are already at the highest belt.');

    // Adult mass sessions need age 13+, children mass sessions need under 13 (private is open to all)
  if (session.type === 'mass_adult' || session.type === 'mass_children') {
    if (!st.date_of_birth) {
      reasons.push('Your date of birth is not recorded. Please contact your dojo admin.');
    } else {
      const age = ageOn(st.date_of_birth, session.session_day);
      if (session.type === 'mass_adult' && age < ADULT_MIN_AGE) reasons.push('This session is for adults (13 and above) only.');
      if (session.type === 'mass_children' && age >= ADULT_MIN_AGE) reasons.push('This session is for children (under 13) only.');
    }
  }
  
  // Membership must be active, no overdue fees
  if (st.has_overdue_fee) reasons.push('You have an overdue fee. Please pay it before applying.');

  // 3 months since the last passed grading/since joining
  const since = st.last_pass || st.joined_on;
  const earliest = new Date(since + 'T00:00:00');
  earliest.setMonth(earliest.getMonth() + MIN_MONTHS_BETWEEN_GRADINGS);
  if (earliest > new Date(session.session_day + 'T00:00:00')) {
    reasons.push('You need at least ' + MIN_MONTHS_BETWEEN_GRADINGS + ' months since your last grading or joining.');
  }

  return { eligible: reasons.length === 0, reasons: reasons };
}

// GET /api/grading-sessions/:id/eligibility 
const checkEligibilityRoute = handle(async (req, res) => {
  const session = await model.getSession(parseId(req.params.id));
  if (!session) throw httpError(404, 'Session not found.');
  const st = await model.getEligibilityData(req.student.id);
  res.json({ window_open: inWindow(session), ...checkEligibility(st, session) });
});

// POST /api/grading-sessions/:id/apply
const apply = handle(async (req, res) => {
  const session = await model.getSession(parseId(req.params.id));
  if (!session) throw httpError(404, 'Session not found.');

  if (!inWindow(session)) throw httpError(400, 'Applications are not open for this session.');

  const st = await model.getEligibilityData(req.student.id);
  const result = checkEligibility(st, session);
  if (!result.eligible) throw httpError(422, 'You are not eligible for this grading.', result.reasons);

  try {
    const application = await model.createApplication(
      session.id, req.student.id, st.belt_id, st.has_overdue_fee ? 'lapsed' : 'active'
    );
    res.status(201).json(application); 
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'You have already applied to this session.');
    throw e;
  }
});

// GET /api/grading-sessions/mine
const myApplications = handle(async (req, res) => {
  res.json(await model.listByStudent(req.student.id));
});

//

// GET /api/grading-sessions/applications?status=pending
const listApplications = handle(async (req, res) => {
  res.json(await model.listApplications(req.query.status));
});

// PATCH /api/grading-sessions/applications/:id
const reviewApplication = handle(async (req, res) => {
  const id = parseId(req.params.id);
  const action = req.body.action;
  const remark = String(req.body.remark || '').trim();
  if (action !== 'approved' && action !== 'rejected') throw httpError(400, "Action must be 'approved' or 'rejected'.");
  if (action === 'rejected' && !remark) throw httpError(400, 'A remark is required to reject.');

  const result = await model.reviewApplication(id, action, remark);
  if (result.error) throw httpError(result.status, result.error);

  // Email student 
  console.log('[EMAIL] To: ' + result.email.to + ' | Hi ' + result.email.name +
    ', your grading application was ' + action + '.' + (remark ? ' Remark: ' + remark : ''));
  res.json(result.application);
});

module.exports = {
  createSession, listSessions,
  checkEligibility: checkEligibilityRoute, apply, myApplications,
  listApplications, reviewApplication,
};