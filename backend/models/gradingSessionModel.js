const db = require('../config/db');

// session + student approved / pending
// const sessionSelect = 'SELECT s.*, c.name AS centre_name, ' +
  "COUNT(a.id) FILTER (WHERE a.status = 'approved')::int AS approved_count, " +
  "COUNT(a.id) FILTER (WHERE a.status = 'pending')::int AS pending_count " +
  'FROM grading_sessions s ' +
  'JOIN centres c ON c.id = s.centre_id ' +
  'LEFT JOIN grading_applications a ON a.session_id = s.id ';//

// CREATE a session - PBI-10
async function createSession(d) {
  const { rows } = await db.query(
    'INSERT INTO grading_sessions ' +
    '(type, centre_id, venue, session_date, session_time, fee, apply_open, apply_close, capacity) ' +
    'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [d.type, d.centre_id, d.venue, d.session_date, d.session_time, d.fee, d.apply_open, d.apply_close, d.capacity]
  );
  return rows[0];
}

// GET all sessions - PBI-10
async function listSessions() {
  const { rows } = await db.query(
    SESSION_SELECT + 'GROUP BY s.id, c.name ORDER BY s.session_date, s.session_time'
  );
  return rows;
}

