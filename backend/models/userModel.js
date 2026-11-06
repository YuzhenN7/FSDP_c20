// USERS - MODEL: database queries for login accounts (used by authController).
const db = require('../config/db');

async function findByEmail(email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
  return rows[0];
}

// Creates a STUDENT account plus its students row (starting on the lowest belt)
async function createStudentAccount(name, email, passwordHash) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'student') RETURNING id, name, email, role`,
    [name, email, passwordHash]
  );
  const user = rows[0];
  await db.query(
    `INSERT INTO students (user_id, belt_id)
     VALUES ($1, (SELECT id FROM belt_levels ORDER BY sort_order LIMIT 1))`,
    [user.id]
  );
  return user;
}

module.exports = { findByEmail, findById, createStudentAccount };
