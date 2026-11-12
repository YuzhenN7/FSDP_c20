// MEMBERS = STUDENTS (admin view) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list all students with centre and current belt
async function listMembers() {
  const { rows } = await db.query(
    `SELECT s.id, u.name, u.email, c.name AS centre, b.name AS belt, s.joined_on
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN centres c ON c.id = s.centre_id
     LEFT JOIN belt_levels b ON b.id = s.belt_id
     ORDER BY u.name`
  );
  return rows;
}

// TODO: PUT /api/members/:id  -> edit a student (e.g. assign a centre)

module.exports = { listMembers };
