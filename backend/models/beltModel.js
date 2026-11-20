// BELT LEVELS - MODEL: the database queries. (Controllers call these; routes never touch the database.)
//
// There are two ladders (the `track` column):
//   adult  - 13 and above:  Mukyu, 6th kyu ... 1st kyu, 1st dan ... 4th dan     (order numbers 0-99)
//   junior - under 13:      Junior mukyu, Junior 12th kyu ... Junior 1st kyu, Junior dan  (order numbers from 100)
// Everyone starts on Mukyu (no rank, white belt). The order numbers of the two ladders never touch,
// so "next belt = order + 1" always stays on the same ladder.
// `grading_fee` is the fee to grade FOR that belt (empty for Mukyu).
const db = require('../config/db');

const COLUMNS = 'id, name, sort_order, track, grading_fee';
const FIRST_ORDER = { adult: 0, junior: 100 };   // where each ladder starts

// list belt levels: adult ladder first, then junior, lowest belt first
async function listBelts() {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM belt_levels ORDER BY sort_order`);
  return rows;
}

// add a belt level; with no sortOrder it goes to the top of its ladder
async function createBelt(name, sortOrder, track, gradingFee) {
  const { rows } = await db.query(
    `INSERT INTO belt_levels (name, sort_order, track, grading_fee)
     VALUES ($1,
             COALESCE($2::int, (SELECT COALESCE(MAX(sort_order) + 1, $5::int) FROM belt_levels WHERE track = $3)),
             $3, $4)
     RETURNING ${COLUMNS}`,
    [name, sortOrder, track, gradingFee, FIRST_ORDER[track]]
  );
  return rows[0];
}

// change a belt level's name and order number (undefined if the id does not exist).
// The grading fee only changes when one is passed in: `gradingFee === undefined` leaves it alone,
// `null` clears it, a number sets it.
async function updateBelt(id, name, sortOrder, gradingFee) {
  const changeFee = gradingFee !== undefined;
  const { rows } = await db.query(
    `UPDATE belt_levels
        SET name = $1, sort_order = $2,
            grading_fee = CASE WHEN $4::boolean THEN $5::numeric ELSE grading_fee END
      WHERE id = $3
     RETURNING ${COLUMNS}`,
    [name, sortOrder, id, changeFee, changeFee ? gradingFee : null]
  );
  return rows[0];
}

// move a belt one step up or down ITS OWN ladder (swaps order numbers with its neighbour)
async function moveBelt(id, direction) {
  return db.transaction(async (q) => {
    const me = await q('SELECT track FROM belt_levels WHERE id = $1', [id]);
    if (me.rows.length === 0) return null;              // belt not found
    const { rows } = await q(
      'SELECT id, sort_order FROM belt_levels WHERE track = $1 ORDER BY sort_order', [me.rows[0].track]
    );
    const i = rows.findIndex((r) => r.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return true;         // already first/last on its ladder: nothing to do
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
