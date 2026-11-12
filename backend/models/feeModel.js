// FEES (admin) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list all fees with the student name and status
async function listFees() {
  const { rows } = await db.query(
    `SELECT f.id, u.name AS student, f.description, f.amount, f.due_date, f.status
     FROM fees f
     JOIN students s ON s.id = f.student_id
     JOIN users u ON u.id = s.user_id
     ORDER BY f.due_date DESC NULLS LAST, f.id DESC`
  );
  return rows;
}

// TODO: POST /api/fees        -> assign a fee { student_id, description, amount, due_date }
// TODO: PUT /api/fees/:id     -> edit a fee
// TODO: DELETE /api/fees/:id  -> remove a fee (only if unpaid)

module.exports = { listFees };
