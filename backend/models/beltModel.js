// BELT LEVELS - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list belt levels, lowest first
async function listBelts() {
  const { rows } = await db.query(
    `SELECT id, name, sort_order FROM belt_levels ORDER BY sort_order`
  );
  return rows;
}

// TODO: POST /api/belts        -> add a belt level
// TODO: PUT /api/belts/:id     -> rename / reorder a belt level
// TODO: DELETE /api/belts/:id  -> remove a belt level

module.exports = { listBelts };
