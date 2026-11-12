// STUDENT PORTAL - MODEL: queries about ONE student (the logged-in one).
const db = require('../config/db');
const crypto = require('crypto'); // gives each payment attempt its own hard-to-guess session id
const { priceBreakdown } = require('../utils/feeCalculator'); 

async function findStudentByUserId(userId) {
  const { rows } = await db.query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return rows[0];
}

async function getCurrentBelt(studentId) {
  const { rows } = await db.query(
    `SELECT b.id, b.name FROM students s
     LEFT JOIN belt_levels b ON b.id = s.belt_id
     WHERE s.id = $1`,
    [studentId]
  );
  return rows[0];
}

async function getGradingHistory(studentId) {
  const { rows } = await db.query(
    `SELECT g.id, b.name AS belt, g.result, g.graded_on, g.notes
     FROM gradings g JOIN belt_levels b ON b.id = g.belt_id
     WHERE g.student_id = $1
     ORDER BY g.graded_on DESC, g.id DESC`,
    [studentId]
  );
  return rows;
}

async function listFees(studentId) {
  const { rows } = await db.query(
    `SELECT id, description, amount, due_date, status
     FROM fees WHERE student_id = $1
     ORDER BY (status = 'unpaid') DESC, due_date DESC NULLS LAST, id DESC`,
    [studentId]
  );
  // Deleted return row;
  // total = what the student actually pays (fee + GST)
  return rows.map((r) => ({ ...r, total: priceBreakdown(Number(r.amount), 0).final }));
}

async function listPayments(studentId) {
  const { rows } = await db.query(
    `SELECT p.id, f.description AS fee, p.amount, p.method, p.reference, p.paid_at, 'paid' AS status
     FROM payments p JOIN fees f ON f.id = p.fee_id
     WHERE f.student_id = $1
     UNION ALL
     SELECT a.id, f.description, a.amount, 'online', a.session_id, a.created_at, 'failed'
     FROM payment_attempts a JOIN fees f ON f.id = a.fee_id
     WHERE f.student_id = $1 AND a.status = 'failed'
     ORDER BY paid_at DESC`,
    [studentId]
  );
  return rows;
}
/*
Added: 
UNION ALL
     SELECT a.id, f.description, a.amount, 'online', a.session_id, a.created_at, 'failed'
     FROM payment_attempts a JOIN fees f ON f.id = a.fee_id
     WHERE f.student_id = $1 AND a.status = 'failed'
*/

async function getPayment(studentId, paymentId) {
  const { rows } = await db.query(
    `SELECT p.id, f.description AS fee, p.amount, p.method, p.reference, p.paid_at, f.status
     FROM payments p JOIN fees f ON f.id = p.fee_id
     WHERE p.id = $1 AND f.student_id = $2`,
    [paymentId, studentId]
  );
  return rows[0];
}

// TODO (online payments): payFee(studentId, feeId)
//   1. check the fee belongs to this student and is still 'unpaid'
//   2. insert a row into payments (method 'online', make up a reference)
//   3. set the fee's status to 'paid'
//   4. return the new payment

// Pay now: make a pending attempt for one unpaid fee that belongs to this student (according to design in figma)
async function createAttempt(studentId, feeId) {
  const { rows } = await db.query(
    'SELECT id, amount, status FROM fees WHERE id = $1 AND student_id = $2',
    [feeId, studentId]
  );
  const fee = rows[0];
  if (!fee) return { code: 404, error: 'Fee not found.' };
  if (fee.status !== 'unpaid') return { code: 400, error: 'This fee is already paid.' };
  const total = priceBreakdown(Number(fee.amount), 0).final; 
  const sessionId = crypto.randomBytes(16).toString('hex');
  await db.query(
    `INSERT INTO payment_attempts (fee_id, session_id, amount, status)
     VALUES ($1, $2, $3, 'pending')`,
    [fee.id, sessionId, total]
  );
  return { sessionId };
}

// The attempt, only if it belongs to this student
async function getAttempt(studentId, sessionId) {
  const { rows } = await db.query(
    `SELECT a.session_id, a.fee_id, a.amount, a.status, a.failure_reason, f.description AS fee,
            f.amount AS subtotal, (a.amount - f.amount) AS gst,
            u.name AS student_name, u.email AS student_email
     FROM payment_attempts a
     JOIN fees f ON f.id = a.fee_id
     JOIN students s ON s.id = f.student_id
     JOIN users u ON u.id = s.user_id
     WHERE a.session_id = $1 AND f.student_id = $2`,
    [sessionId, studentId]
  );
  return rows[0];
}

// The "webhook" handler: apply the gateway's result. Safe to call twice.
async function settleAttempt(studentId, sessionId, outcome, reason) {
  const reference = 'SIM-' + sessionId.slice(0, 10).toUpperCase();
  if (outcome === 'success') {
    // one statement, so the three changes happen together or not at all
    await db.query(
      `WITH a AS (
         UPDATE payment_attempts SET status = 'paid'
         WHERE session_id = $1 AND status = 'pending'
           AND fee_id IN (SELECT id FROM fees WHERE student_id = $2 AND status = 'unpaid')
         RETURNING fee_id, amount
       ), p AS (
         INSERT INTO payments (fee_id, amount, method, reference, paid_at)
         SELECT fee_id, amount, 'online', $3, NOW() FROM a
         RETURNING id
       )
       UPDATE fees SET status = 'paid' WHERE id IN (SELECT fee_id FROM a)`,
      [sessionId, studentId, reference]
    );
  } else {
    await db.query(
      `UPDATE payment_attempts SET status = 'failed', failure_reason = $3
       WHERE session_id = $1 AND status = 'pending'
         AND fee_id IN (SELECT id FROM fees WHERE student_id = $2)`,
      [sessionId, studentId, reason || 'Payment declined']
    );
  }
  const attempt = await getAttempt(studentId, sessionId);
  const { rows } = await db.query('SELECT id FROM payments WHERE reference = $1', [reference]);
  return { attempt, paymentId: rows[0] ? rows[0].id : null };
}

module.exports = {
  findStudentByUserId, 
  getCurrentBelt, 
  getGradingHistory, 
  listFees, 
  listPayments, 
  getPayment,
  createAttempt, 
  getAttempt, 
  settleAttempt,
};
