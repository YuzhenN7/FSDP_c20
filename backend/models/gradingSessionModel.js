const db = require('../config/db');

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
    'SELECT s.*, c.name AS centre_name ' +
    'FROM grading_sessions s JOIN centres c ON c.id = s.centre_id ' +
    'ORDER BY s.session_date, s.session_time'
  );
  return rows;
}

// GET session by id - PBI-14
async function getSession(id) {
  const { rows } = await db.query(
    "SELECT s.*, to_char(s.session_date, 'YYYY-MM-DD') AS session_day, c.name AS centre_name " +
    'FROM grading_sessions s JOIN centres c ON c.id = s.centre_id ' +
    'WHERE s.id = $1',
    [id]
  );
  return rows[0] || null;
}

// GET students eligibility data - PBI-14
async function getEligibilityData(studentId) {
  const { rows } = await db.query(
    'SELECT s.id, s.belt_id, s.date_of_birth::text AS date_of_birth, s.joined_on::text AS joined_on, ' +
    "(SELECT MAX(g.graded_on)::text FROM gradings g WHERE g.student_id = s.id AND g.result = 'pass') AS last_pass, " +
    "EXISTS (SELECT 1 FROM fees f WHERE f.student_id = s.id AND f.status = 'unpaid' AND f.due_date < CURRENT_DATE) AS has_overdue_fee, " +
    '(SELECT nb.id FROM belt_levels nb WHERE nb.sort_order = b.sort_order + 1) AS next_belt_id ' +
    'FROM students s LEFT JOIN belt_levels b ON b.id = s.belt_id ' +
    'WHERE s.id = $1',
    [studentId]
  );
  return rows[0] || null;
}

// Create application
async function createApplication(sessionId, studentId, beltId, membershipStatus) {
  const { rows } = await db.query(
    'INSERT INTO grading_applications (session_id, student_id, belt_id, membership_status) ' +
    'VALUES ($1, $2, $3, $4) RETURNING *',
    [sessionId, studentId, beltId, membershipStatus]
  );
  return rows[0];
}

// GET student's own applications
async function listByStudent(studentId) {
  const { rows } = await db.query(
    'SELECT a.id, a.session_id, a.status, a.remark, a.applied_at, ' +
    's.type, s.venue, s.session_date, s.session_time, s.fee, c.name AS centre_name ' +
    'FROM grading_applications a ' +
    'JOIN grading_sessions s ON s.id = a.session_id ' +
    'JOIN centres c ON c.id = s.centre_id ' +
    'WHERE a.student_id = $1 ORDER BY a.applied_at DESC, a.id DESC',
    [studentId]
  );
  return rows;
}

module.exports = { createSession, listSessions, getSession, getEligibilityData, createApplication, listByStudent };