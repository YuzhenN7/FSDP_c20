const db = require('../config/db');

async function getAll() {
  const r = await db.query('SELECT id, name, sort_order FROM belt_levels ORDER BY sort_order, id');
  return r.rows;
}

// sortOrder is optional: when null, the new belt goes to the end of the list
async function create(name, sortOrder) {
  const r = await db.query(
    `INSERT INTO belt_levels (name, sort_order)
     VALUES ($1, COALESCE($2::int, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM belt_levels)))
     RETURNING id, name, sort_order`,
    [name, sortOrder]
  );
  return r.rows[0];
}

async function update(id, name, sortOrder) {
  const r = await db.query(
    'UPDATE belt_levels SET name = $1, sort_order = $2 WHERE id = $3 RETURNING id, name, sort_order',
    [name, sortOrder, id]
  );
  return r.rows[0]; // undefined if the id does not exist
}

async function remove(id) {
  const r = await db.query('DELETE FROM belt_levels WHERE id = $1 RETURNING id', [id]);
  return r.rows[0];
}

module.exports = { getAll, create, update, remove };