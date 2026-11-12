<<<<<<< Updated upstream
=======
// GRADING RESULTS - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// GET grading results
async function listGradings() {
  const { rows } = await db.query(
    'SELECT g.id, u.name AS student, b.name AS belt, g.result, g.graded_on, g.notes ' +
    'FROM gradings g ' +
    'JOIN students s ON s.id = g.student_id ' +
    'JOIN users u ON u.id = s.user_id ' +
    'JOIN belt_levels b ON b.id = g.belt_id ' +
    'ORDER BY g.graded_on DESC, g.id DESC'
  );
  return rows;
}

// CREATE a result { student_id, belt_id, result, graded_on, notes }
async function recordGrading(d) {
  return db.transaction(async (tx) => {
    const inserted = await tx.query(
      'INSERT INTO gradings (student_id, belt_id, result, graded_on, notes) ' +
      'VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5) RETURNING *',
      [d.student_id, d.belt_id, d.result, d.graded_on || null, d.notes || null]
    );
    if (d.result === 'pass') {
      await tx.query('UPDATE students SET belt_id = $1 WHERE id = $2', [d.belt_id, d.student_id]);
    }
    return inserted.rows[0];
  });
}

module.exports = { listGradings, recordGrading };
>>>>>>> Stashed changes
