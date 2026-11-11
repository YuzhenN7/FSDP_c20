// FEE PACKAGES - MODEL: database queries for fee_packages and fee_package_items
const db = require('../config/db');

// every package with the fee types inside it
async function listPackages() {
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.student_group, p.discount_percent, p.validity, p.description, p.is_active,
            COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'base_amount', t.base_amount)
                              ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS items
     FROM fee_packages p
     LEFT JOIN fee_package_items i ON i.package_id = p.id
     LEFT JOIN fee_types t ON t.id = i.fee_type_id
     GROUP BY p.id
     ORDER BY p.id`
  );
  return rows;
}

// checks whether the fees are allowed as some of the fees such as Grading fee and late fee are not allowed so like need to check whether it is the correct fee
async function countPackable(ids) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM fee_types
     WHERE id = ANY($1::int[]) AND can_be_in_package AND base_amount IS NOT NULL`,
    [ids]
  );
  return rows[0].n;
}

// Creates a new package 
// if name of package already exists, then an error will pop up 
async function createPackage(d) {
  const { rows } = await db.query(
    `WITH p AS (
       INSERT INTO fee_packages (name, student_group, discount_percent, validity, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
     ), i AS (
       INSERT INTO fee_package_items (package_id, fee_type_id)
       SELECT p.id, t FROM p, unnest($7::int[]) AS t
     )
     SELECT id FROM p`,
    [d.name, d.student_group, d.discount_percent, d.validity, d.description, d.is_active, d.fee_type_ids]
  );
  return rows[0].id;
}

// update an existing package (make changes to the package)
async function updatePackage(id, d) {
  const { rows } = await db.query(
    `WITH u AS (
       UPDATE fee_packages SET name = $2, student_group = $3, discount_percent = $4,
              validity = $5, description = $6, is_active = $7
       WHERE id = $1 RETURNING id
     ), del AS (
       DELETE FROM fee_package_items
       WHERE package_id = $1 AND fee_type_id <> ALL($8::int[]) AND EXISTS (SELECT 1 FROM u)
     ), ins AS (
       INSERT INTO fee_package_items (package_id, fee_type_id)
       SELECT u.id, t FROM u, unnest($8::int[]) AS t
       ON CONFLICT DO NOTHING
     )
     SELECT id FROM u`,
    [id, d.name, d.student_group, d.discount_percent, d.validity, d.description, d.is_active, d.fee_type_ids]
  );
  return rows[0];
}

// Like Fee managment, it can be active or inactive 
async function setActive(id, isActive) {
  const { rows } = await db.query(
    'UPDATE fee_packages SET is_active = $2 WHERE id = $1 RETURNING id', [id, isActive]
  );
  return rows[0];
}

module.exports = { listPackages, countPackable, createPackage, updatePackage, setActive };