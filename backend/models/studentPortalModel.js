// STUDENT PORTAL - MODEL: queries about ONE student (the logged-in one).
const db = require('../config/db');
const crypto = require('crypto'); // gives each payment attempt its own hard-to-guess session id

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
  return rows;
}

async function listPayments(studentId) {
  const { rows } = await db.query(
    `SELECT p.id, f.description AS fee, p.amount, p.method, p.reference, p.paid_at
     FROM payments p JOIN fees f ON f.id = p.fee_id
     WHERE f.student_id = $1
     ORDER BY p.paid_at DESC`,
    [studentId]
  );
  return rows;
}

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
  const sessionId = crypto.randomBytes(16).toString('hex');
  await db.query(
    `INSERT INTO payment_attempts (fee_id, session_id, amount, status)
     VALUES ($1, $2, $3, 'pending')`,
    [fee.id, sessionId, fee.amount]
  );
  return { sessionId };
}

// 

module.exports = {
  findStudentByUserId, getCurrentBelt, getGradingHistory, listFees, listPayments, getPayment,
};
