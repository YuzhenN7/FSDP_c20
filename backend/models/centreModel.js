// CENTRES - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list all centres
async function listCentres() {
  const { rows } = await db.query(
    `SELECT id, name, address FROM centres ORDER BY name`
  );
  return rows;
}

// TODO: POST /api/centres        -> add a centre
// TODO: PUT /api/centres/:id     -> edit a centre
// TODO: DELETE /api/centres/:id  -> remove a centre

module.exports = { listCentres };
