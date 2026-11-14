// SCRUM-6: input validation + API responses for administrator student management.
const bcrypt = require('bcryptjs');
const memberModel = require('../models/memberModel');

const STATES = ['active', 'suspended', 'inactive'];
const CONCESSIONS = ['none', 'student', 'nsf'];   // senior (65+) is worked out from the date of birth
const isDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const idOrNull = (n) => n === '' || n == null ? null : Number.isSafeInteger(Number(n)) && Number(n) > 0 ? Number(n) : NaN;
const validEmail = (s) => /^\S+@\S+\.\S+$/.test(s);

function normalise(input = {}, forCreate = false) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const centre_id = idOrNull(input.centre_id);
  const belt_id = idOrNull(input.belt_id);
  const joined_on = input.joined_on || new Date().toISOString().slice(0, 10);
  const membership_status = input.membership_status || 'active';
  // Both are optional. On an edit, leaving one out of the request keeps what is already saved.
  const sent = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const date_of_birth = !sent('date_of_birth') && !forCreate ? undefined : (input.date_of_birth || null);
  const concession = !sent('concession') && !forCreate ? undefined : (input.concession || 'none');
  if (!name || name.length > 150 || !validEmail(email)) return { error: 'Enter a name and valid email.' };
  if (!Number.isInteger(centre_id) || !Number.isInteger(belt_id)) {
    return { error: 'Choose a principal dojo and current belt.' };
  }
  if (!isDate(joined_on) || !STATES.includes(membership_status)) {
    return { error: 'Choose a valid membership date and status.' };
  }
  if (date_of_birth != null && (!isDate(date_of_birth) || date_of_birth > new Date().toISOString().slice(0, 10))) {
    return { error: 'Enter a valid date of birth (not in the future).' };
  }
  if (concession !== undefined && !CONCESSIONS.includes(concession)) return { error: 'Choose a valid concession.' };
  if (forCreate && (typeof input.password !== 'string' || input.password.length < 8)) {
    return { error: 'Set an initial password of at least 8 characters.' };
  }
  return { name, email, centre_id, belt_id, joined_on, membership_status, date_of_birth, concession };
}

function dbError(err, res, next) {
  if (err.code === '23505') return res.status(409).json({ error: 'A student with this email already exists, or another unique value conflicts.' });
  if (err.code === '23503') return res.status(400).json({ error: 'The selected dojo or belt does not exist.' });
  return next(err);
}

async function listMembers(req, res, next) {
  try {
    const search = String(req.query.search || '').trim().slice(0, 100);
    const centre_id = idOrNull(req.query.centre_id);
    const status = String(req.query.status || '').trim();
    if (Number.isNaN(centre_id) || (status && !STATES.includes(status))) {
      return res.status(400).json({ error: 'Invalid student filter.' });
    }
    res.json(await memberModel.listMembers({ search, centre_id, status }));
  } catch (err) { next(err); }
}

async function options(req, res, next) {
  try { res.json(await memberModel.listOptions()); } catch (err) { next(err); }
}

async function createMember(req, res, next) {
  const record = normalise(req.body, true);
  if (record.error) return res.status(400).json({ error: record.error });
  try {
    record.passwordHash = await bcrypt.hash(req.body.password, 10);
    res.status(201).json(await memberModel.createMember(record));
  } catch (err) { dbError(err, res, next); }
}

async function updateMember(req, res, next) {
  const record = normalise(req.body);
  if (record.error) return res.status(400).json({ error: record.error });
  try {
    const updated = await memberModel.updateMember(req.params.id, record);
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    res.json(updated);
  } catch (err) { dbError(err, res, next); }
}

async function deactivateMember(req, res, next) {
  try {
    const updated = await memberModel.deactivateMember(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    res.json(updated);
  } catch (err) { next(err); }
}

module.exports = { listMembers, options, createMember, updateMember, deactivateMember };
