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

// add a belt level; with no sortOrder it goes to the end of the ladder
async function createBelt(name, sortOrder) {
  const { rows } = await db.query(
    `INSERT INTO belt_levels (name, sort_order)
     VALUES ($1, COALESCE($2::int, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM belt_levels)))
     RETURNING id, name, sort_order`,
    [name, sortOrder]
  );
  return rows[0];
}

// rename a belt level (undefined if the id does not exist)
async function updateBelt(id, name, sortOrder) {
  const { rows } = await db.query(
    `UPDATE belt_levels SET name = $1, sort_order = $2 WHERE id = $3
     RETURNING id, name, sort_order`,
    [name, sortOrder, id]
  );
  return rows[0];
}

// move a belt one step up or down the ladder (swaps order numbers with its neighbour)
async function moveBelt(id, direction) {
  return db.transaction(async (q) => {
    const { rows } = await q('SELECT id, sort_order FROM belt_levels ORDER BY sort_order', []);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;                          // belt not found
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return true;         // already first/last: nothing to do
    const a = rows[i];
    const b = rows[j];
    // park one belt on -1 first so the two swapped numbers never clash
    await q('UPDATE belt_levels SET sort_order = -1 WHERE id = $1', [a.id]);
    await q('UPDATE belt_levels SET sort_order = $1 WHERE id = $2', [a.sort_order, b.id]);
    await q('UPDATE belt_levels SET sort_order = $1 WHERE id = $2', [b.sort_order, a.id]);
    return true;
  });
}

// remove a belt level (undefined if the id does not exist)
async function deleteBelt(id) {
  const { rows } = await db.query(
    `DELETE FROM belt_levels WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0];
}

module.exports = { listBelts, createBelt, updateBelt, moveBelt, deleteBelt };
