// SCRUM-6: admin student records. Updates users + students in one SQL statement.
const db = require('../config/db');

const details = `SELECT s.id, s.user_id, u.name, u.email, s.centre_id,
                       c.name AS centre, s.belt_id, b.name AS belt,
                       s.joined_on, s.membership_status
                  FROM students s JOIN users u ON u.id = s.user_id
                  LEFT JOIN centres c ON c.id = s.centre_id
                  LEFT JOIN belt_levels b ON b.id = s.belt_id`;

async function listMembers({ search = '', centre_id = null, status = '' } = {}) {
  const { rows } = await db.query(
    `${details} WHERE ($1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
       AND ($2::integer IS NULL OR s.centre_id = $2::integer)
       AND ($3 = '' OR s.membership_status = $3)
       ORDER BY u.name, s.id`, [search, centre_id, status]
  );
  return rows;
}

async function getMember(id) {
  const { rows } = await db.query(`${details} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

async function listOptions() {
  const [centres, belts] = await Promise.all([
    db.query('SELECT id, name FROM centres ORDER BY name'),
    db.query('SELECT id, name FROM belt_levels ORDER BY sort_order'),
  ]);
  return { centres: centres.rows, belts: belts.rows };
}

async function createMember({ name, email, passwordHash, centre_id, belt_id, joined_on, membership_status }) {
  const { rows } = await db.query(
    `WITH new_user AS (
       INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, 'student') RETURNING id
     ), new_student AS (
       INSERT INTO students (user_id, centre_id, belt_id, joined_on, membership_status)
       SELECT id, $4, $5, $6::date, $7 FROM new_user RETURNING id
     )
     SELECT id FROM new_student`,
    [name, email, passwordHash, centre_id, belt_id, joined_on, membership_status]
  );
  return getMember(rows[0].id);
}

async function updateMember(id, { name, email, centre_id, belt_id, joined_on, membership_status }) {
  const { rows } = await db.query(
    `WITH updated_user AS (
       UPDATE users AS u SET name = $2, email = LOWER($3)
       FROM students AS s WHERE s.id = $1 AND s.user_id = u.id
       RETURNING u.id
     ), updated_student AS (
       UPDATE students AS s
          SET centre_id = $4, belt_id = $5, joined_on = $6::date, membership_status = $7
         FROM updated_user u WHERE s.id = $1 AND s.user_id = u.id
       RETURNING s.id
     )
     SELECT id FROM updated_student`,
    [id, name, email, centre_id, belt_id, joined_on, membership_status]
  );
  return rows.length ? getMember(rows[0].id) : null;
}

async function deactivateMember(id) {
  const { rows } = await db.query(
    `UPDATE students SET membership_status = 'inactive' WHERE id = $1 RETURNING id`, [id]
  );
  return rows.length ? getMember(id) : null;
}

module.exports = { listMembers, getMember, listOptions, createMember, updateMember, deactivateMember };
