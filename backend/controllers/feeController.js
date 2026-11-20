// FEES (admin) - CONTROLLER: reads the request, calls the model, sends the answer.
const bcrypt = require('bcryptjs');
const feeModel = require('../models/feeModel');

const STATUSES = ['pending', 'overdue', 'paid', 'void'];
const METHODS = ['cash', 'paynow', 'card'];          // how money is taken at the counter
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- Small checks used by several functions ----------
const text = (value, max = 200) => String(value == null ? '' : value).trim().slice(0, max);
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);   // Singapore date

// a whole number above 0, or null
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
// money above 0 with at most 2 decimals, or null
function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}
// a list of ids with no repeats, or null if anything in it is not an id
function parseIds(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = value.map(parseId);
  return ids.includes(null) ? null : [...new Set(ids)];
}
// '2026-12-13' -> '13 Dec 2026'
function niceDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
// Counter payments and settling: method, optional reference, optional date paid (not in the future)
function parsePayment(body) {
  const method = text(body.method, 20).toLowerCase();
  const reference = text(body.reference, 60) || null;
  const paidOn = body.paid_on ? String(body.paid_on) : null;
  if (!METHODS.includes(method)) return { error: 'Choose how it was paid: cash, PayNow or card.' };
  if (paidOn !== null && (!isDate(paidOn) || paidOn > today())) return { error: 'Enter a valid payment date (not in the future).' };
  // A date on its own means "that day"; today is recorded with the actual time
  return { method, reference, paidOn: paidOn === null || paidOn === today() ? null : paidOn };
}

// ---------- GET /api/fees?centre_id=&status=&search= ----------
async function listFees(req, res) {
  const status = text(req.query.status, 20).toLowerCase();
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status filter.' });
  res.json(await feeModel.listFees({
    centreId: parseId(req.query.centre_id),
    status: status || null,
    search: text(req.query.search, 80) || null,
  }));
}

// ---------- GET /api/fees/options ----------
async function listOptions(req, res) {
  res.json(await feeModel.listOptions());
}

// ---------- GET /api/fees/grading-applicants ----------
// Approved grading applications not charged yet, each with the belt being graded for and its fee
async function listGradingApplicants(req, res) {
  res.json(await feeModel.listGradingApplicants());
}

// ---------- POST /api/fees/grading   { application_ids: [1, 2], due_date } ----------
// One charge per application, at the fee of the belt that student is grading for.
async function raiseGradingFees(req, res) {
  const ids = parseIds(req.body.application_ids);
  const dueDate = req.body.due_date;
  if (!ids) return res.status(400).json({ error: 'Select at least one student.' });
  if (!isDate(dueDate)) return res.status(400).json({ error: 'Enter a due date.' });

  const describe = (a) => `Grading fee: ${a.target_belt} (${niceDate(a.session_date)})`;
  const result = await feeModel.raiseGradingFees(ids, dueDate, req.user.id, describe);
  if (result.created.length === 0) {
    const why = result.skipped.length ? ' ' + result.skipped.map((s) => `${s.student}: ${s.reason}`).join(' ') : '';
    return res.status(409).json({ error: 'No charges were raised. They may already have been charged.' + why });
  }
  res.status(201).json({ created: result.created.length, skipped: result.skipped });
}

// ---------- POST /api/fees   { student_ids: [5], description, amount, due_date } ----------
// Raise the same unpaid charge for one or many students (used for the late fee).
async function createCharges(req, res) {
  const studentIds = parseIds(req.body.student_ids);
  const description = text(req.body.description, 150);
  const amount = parseAmount(req.body.amount);
  const dueDate = req.body.due_date;
  if (!studentIds) return res.status(400).json({ error: 'Choose a student.' });
  if (!description) return res.status(400).json({ error: 'Enter what the charge is for.' });
  if (amount === null) return res.status(400).json({ error: 'Enter an amount above 0.' });
  if (!isDate(dueDate)) return res.status(400).json({ error: 'Enter a due date.' });

  const created = await feeModel.createCharges(studentIds, description, amount, dueDate, req.user.id);
  if (created.length === 0) return res.status(404).json({ error: 'Student not found.' });
  res.status(201).json({ created: created.length });
}

// ---------- POST /api/fees/counter ----------
// { student_id, items: [{ description, amount }], method, reference, paid_on }
// Money already taken at the dojo: each item is created as a PAID charge with its payment record.
async function recordCounterPayment(req, res) {
  const studentId = parseId(req.body.student_id);
  if (!studentId) return res.status(400).json({ error: 'Choose a student.' });
  if (!Array.isArray(req.body.items) || req.body.items.length === 0 || req.body.items.length > 20) {
    return res.status(400).json({ error: 'Tick at least one fee.' });
  }
  const items = req.body.items.map((item) => ({
    description: text(item && item.description, 150),
    amount: parseAmount(item && item.amount),
  }));
  if (items.some((item) => !item.description || item.amount === null)) {
    return res.status(400).json({ error: 'Every ticked fee needs an amount above 0.' });
  }
  const payment = parsePayment(req.body);
  if (payment.error) return res.status(400).json({ error: payment.error });

  try {
    const created = await feeModel.recordCounterPayment(
      studentId, items, payment.method, payment.reference, payment.paidOn, req.user.id
    );
    res.status(201).json({ created: created.length, total: items.reduce((sum, item) => sum + item.amount, 0) });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Student not found.' });   // no such student
    throw err;
  }
}

// ---------- POST /api/fees/:id/settle   { method, reference, paid_on } ----------
async function settleFee(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid fee id.' });
  const payment = parsePayment(req.body);
  if (payment.error) return res.status(400).json({ error: payment.error });

  if (!(await feeModel.getFee(id))) return res.status(404).json({ error: 'Charge not found.' });
  const done = await feeModel.settleFee(id, payment.method, payment.reference, payment.paidOn);
  if (!done) return res.status(409).json({ error: 'Only a pending or overdue charge can be settled.' });
  res.json(await feeModel.getFee(id));
}

// ---------- PUT /api/fees/:id   { amount, due_date, reason } ----------
async function editFee(req, res) {
  const id = parseId(req.params.id);
  const amount = parseAmount(req.body.amount);
  const dueDate = req.body.due_date || null;
  const reason = text(req.body.reason, 200);
  if (!id) return res.status(400).json({ error: 'Invalid fee id.' });
  if (amount === null) return res.status(400).json({ error: 'Enter an amount above 0.' });
  if (dueDate !== null && !isDate(dueDate)) return res.status(400).json({ error: 'Enter a valid due date.' });
  if (!reason) return res.status(400).json({ error: 'Give a reason for the change.' });

  if (!(await feeModel.getFee(id))) return res.status(404).json({ error: 'Charge not found.' });
  const done = await feeModel.editFee(id, amount, dueDate, reason, req.user.id);
  if (!done) return res.status(409).json({ error: 'Paid and voided charges are locked and cannot be edited.' });
  res.json(await feeModel.getFee(id));
}

// ---------- POST /api/fees/:id/void   { reason, password } ----------
// The admin signs by re-entering their own password. Their name, the time and the reason are stored.
async function voidFee(req, res) {
  const id = parseId(req.params.id);
  const reason = text(req.body.reason, 200);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!id) return res.status(400).json({ error: 'Invalid fee id.' });
  if (!reason) return res.status(400).json({ error: 'A reason is required to void a charge.' });
  if (!password) return res.status(400).json({ error: 'Re-enter your password to sign.' });

  const hash = await feeModel.getPasswordHash(req.user.id);
  if (!hash || !(await bcrypt.compare(password, hash))) {
    // 403, not 401: a 401 would make the page think the login has expired
    return res.status(403).json({ error: 'Password is incorrect. The charge was not voided.' });
  }

  if (!(await feeModel.getFee(id))) return res.status(404).json({ error: 'Charge not found.' });
  const done = await feeModel.voidFee(id, reason, req.user.id);
  if (!done) return res.status(409).json({ error: 'Only a pending or overdue charge can be voided.' });
  res.json(await feeModel.getFee(id));
}

module.exports = {
  listFees, listOptions, listGradingApplicants, raiseGradingFees,
  createCharges, recordCounterPayment, settleFee, editFee, voidFee,
};
