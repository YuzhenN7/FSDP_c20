const db = require('../config/db');

async function listFeeTypes() {
  const { rows } = await db.query('SELECT * FROM fee_types ORDER BY id');
  return rows;
}

async function createFeeType(d) {
  const { rows } = await db.query(
    `INSERT INTO fee_types (name, category, student_group, base_amount, discount_percent, can_be_in_package, description, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [d.name, d.category, d.student_group, d.base_amount, d.discount_percent, d.can_be_in_package, d.description, d.is_active]
  );
  return rows[0];
}

async function updateFeeType(id, d) {
  const { rows } = await db.query(
    `UPDATE fee_types
     SET name = $1, category = $2, student_group = $3, base_amount = $4, discount_percent = $5,
         can_be_in_package = $6, description = $7, is_active = $8
     WHERE id = $9 RETURNING *`,
    [d.name, d.category, d.student_group, d.base_amount, d.discount_percent, d.can_be_in_package, d.description, d.is_active, id]
  );
  return rows[0];
}

async function setActive(id, isActive) {
  const { rows } = await db.query('UPDATE fee_types SET is_active = $1 WHERE id = $2 RETURNING *', [isActive, id]);
  return rows[0];
}

module.exports = { listFeeTypes, createFeeType, updateFeeType, setActive };