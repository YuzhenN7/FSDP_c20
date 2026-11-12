// Login accounts; this main-branch schema uses users.id and students.user_id.
const db = require('../config/db');

async function findByEmail(email) {
  const { rows } = await db.query(
    `SELECT u.*, s.membership_status
       FROM users u LEFT JOIN students s ON s.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)`, [email]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, s.membership_status
       FROM users u LEFT JOIN students s ON s.user_id = u.id
      WHERE u.id = $1`, [id]
  );
  return rows[0];
}

// Existing public registration is preserved until team confirms onboarding policy.
async function createStudentAccount(name, email, passwordHash) {
  const { rows } = await db.query(
    `WITH new_user AS (
       INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, 'student') RETURNING id, name, email, role
     ), new_student AS (
       INSERT INTO students (user_id, belt_id)
       SELECT id, (SELECT id FROM belt_levels ORDER BY sort_order LIMIT 1)
       FROM new_user RETURNING id
     )
     SELECT id, name, email, role FROM new_user`,
    [name, email, passwordHash]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, createStudentAccount };
