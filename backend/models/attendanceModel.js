// ATTENDANCE (admin) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list attendance records, newest first
async function listAttendance() {
  const { rows } = await db.query(
    `SELECT a.id, a.class_date, a.status, u.name AS student, cl.name AS class, c.name AS centre
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     JOIN users u ON u.id = s.user_id
     JOIN classes cl ON cl.id = a.class_id
     JOIN centres c ON c.id = cl.centre_id
     ORDER BY a.class_date DESC, u.name`
  );
  return rows;
}

// TODO: POST /api/attendance  -> mark a student present/absent for a class on a date { class_id, student_id, class_date, status }

module.exports = { listAttendance };
