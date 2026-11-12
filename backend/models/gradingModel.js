// GRADING RESULTS 
const db = require('../config/db');

// list grading results, newest first
async function listGradings() {
  const { rows } = await db.query(
    `SELECT g.id, u.name AS student, b.name AS belt, g.result, g.graded_on, g.notes
     FROM gradings g
     JOIN students s ON s.id = g.student_id
     JOIN users u ON u.id = s.user_id
     JOIN belt_levels b ON b.id = g.belt_id
     ORDER BY g.graded_on DESC, g.id DESC`
  );
  return rows;
}

// TODO: POST /api/gradings  -> record a result { student_id, belt_id, result, graded_on, notes }
// TODO:                        if result is 'pass', also update students.belt_id for that student

module.exports = { listGradings };
