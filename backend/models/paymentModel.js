// PAYMENTS (admin view / payment tracking) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list all payments, newest first
async function listPayments() {
  const { rows } = await db.query(
    `SELECT p.id, u.name AS student, f.description AS fee, p.amount, p.method, p.reference, p.paid_at
     FROM payments p
     JOIN fees f ON f.id = p.fee_id
     JOIN students s ON s.id = f.student_id
     JOIN users u ON u.id = s.user_id
     ORDER BY p.paid_at DESC`
  );
  return rows;
}

// TODO: filters (by centre, date range, student) for payment tracking

module.exports = { listPayments };
