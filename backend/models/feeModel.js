// FEES (admin) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
//
// A row in `fees` is one charge to one student. Its status in the database is:
//   unpaid - raised, waiting for payment     (the page shows Pending, or Overdue after the due date)
//   paid   - settled; there is a matching row in `payments`
//   void   - cancelled but kept on record with who voided it, when and why
const db = require('../config/db');

// Today's date in Singapore, so "overdue" flips at local midnight rather than UTC midnight
const TODAY = `(now() AT TIME ZONE 'Asia/Singapore')::date`;

// One charge with everything the Fees page shows about it
const FEE_SELECT = `
  SELECT f.id, f.student_id, u.name AS student, s.centre_id, c.name AS centre,
         f.description, f.amount, f.due_date, f.status,
         CASE WHEN f.status = 'unpaid' AND f.due_date < ${TODAY} THEN 'overdue'
              WHEN f.status = 'unpaid' THEN 'pending'
              ELSE f.status END AS display_status,
         (SELECT COALESCE(SUM(x.amount), 0)::float FROM fees x
           WHERE x.student_id = f.student_id AND x.status = 'unpaid') AS balance,
         p.method AS paid_method, p.reference AS paid_reference, p.paid_at,
         f.void_reason, vu.name AS voided_by, f.voided_at
  FROM fees f
  JOIN students s ON s.id = f.student_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN centres c ON c.id = s.centre_id
  LEFT JOIN users vu ON vu.id = f.voided_by
  LEFT JOIN LATERAL (
    SELECT method, reference, paid_at FROM payments WHERE fee_id = f.id ORDER BY paid_at DESC LIMIT 1
  ) p ON TRUE`;

// list charges, newest due date first. Every filter is optional:
//   centreId - students of one centre      status - pending / overdue / paid / void
//   search   - part of the student's name or email
async function listFees({ centreId = null, status = null, search = null } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM (${FEE_SELECT}
       WHERE ($1::int IS NULL OR s.centre_id = $1::int)
         AND ($3::text IS NULL OR u.name ILIKE '%' || $3 || '%' OR u.email ILIKE '%' || $3 || '%')
     ) q
     WHERE ($2::text IS NULL OR q.display_status = $2)
     ORDER BY q.due_date DESC NULLS LAST, q.id DESC`,
    [centreId, status, search]
  );
  return rows;
}

// one charge (undefined if the id does not exist)
async function getFee(id) {
  const { rows } = await db.query(`${FEE_SELECT} WHERE f.id = $1`, [id]);
  return rows[0];
}

// what the forms on the Fees page need: centres, students (with their unpaid balance), fee types, packages
async function listOptions() {
  const [centres, students, feeTypes, packages] = await Promise.all([
    db.query('SELECT id, name FROM centres ORDER BY name'),
    db.query(
      `SELECT s.id, u.name, s.centre_id, b.name AS belt, s.date_of_birth::text AS date_of_birth, s.concession,
              (SELECT COALESCE(SUM(f.amount), 0)::float FROM fees f
                WHERE f.student_id = s.id AND f.status = 'unpaid') AS balance
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN belt_levels b ON b.id = s.belt_id
       WHERE s.membership_status <> 'inactive'
       ORDER BY u.name`
    ),
    db.query(
      `SELECT id, name, category, student_group, base_amount, description
       FROM fee_types WHERE is_active ORDER BY category, base_amount NULLS LAST, name`
    ),
    db.query(
      `SELECT p.id, p.name, p.discount_percent,
              COALESCE(json_agg(i.fee_type_id) FILTER (WHERE i.fee_type_id IS NOT NULL), '[]'::json) AS fee_type_ids
       FROM fee_packages p
       LEFT JOIN fee_package_items i ON i.package_id = p.id
       WHERE p.is_active
       GROUP BY p.id ORDER BY p.name`
    ),
  ]);
  return { centres: centres.rows, students: students.rows, fee_types: feeTypes.rows, packages: packages.rows };
}

// ---------- Grading fees ----------

// Approved grading applications that have not been charged yet, with the belt each student is
// grading FOR (the next one up their ladder) and that belt's grading fee.
// `ids` limits the list to those application ids (used when raising the charges).
const APPLICANT_SELECT = `
  SELECT a.id AS application_id, a.session_id, gs.type AS session_type,
         gs.session_date::text AS session_date, sc.name AS session_centre,
         s.id AS student_id, u.name AS student, c.name AS centre,
         s.date_of_birth::text AS date_of_birth, s.concession,
         cb.name AS current_belt, cb.track,
         nb.name AS target_belt, nb.grading_fee
  FROM grading_applications a
  JOIN grading_sessions gs ON gs.id = a.session_id
  JOIN centres sc ON sc.id = gs.centre_id
  JOIN students s ON s.id = a.student_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN centres c ON c.id = s.centre_id
  LEFT JOIN belt_levels cb ON cb.id = COALESCE(a.belt_id, s.belt_id)
  LEFT JOIN belt_levels nb ON nb.sort_order = cb.sort_order + 1
  WHERE a.status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM fees f WHERE f.grading_application_id = a.id AND f.status <> 'void')
    AND ($1::int[] IS NULL OR a.id = ANY($1::int[]))
  ORDER BY gs.session_date, nb.sort_order NULLS LAST, u.name`;

// The grading sessions tables come from the grading feature. Until they exist in this database
// (error 42P01 = "table does not exist") there are simply no applicants to show.
const noGradingTables = (err) => err && err.code === '42P01';

async function listGradingApplicants() {
  try {
    const [applicants, sessions] = await Promise.all([
      db.query(APPLICANT_SELECT, [null]),
      db.query(
        `SELECT gs.id, gs.type, gs.session_date::text AS session_date, c.name AS centre
         FROM grading_sessions gs JOIN centres c ON c.id = gs.centre_id
         ORDER BY gs.session_date DESC`
      ),
    ]);
    return { available: true, sessions: sessions.rows, applicants: applicants.rows };
  } catch (err) {
    if (noGradingTables(err)) return { available: false, sessions: [], applicants: [] };
    throw err;
  }
}

// Raise one grading fee per application. `describe(applicant)` builds the description.
// Returns { created: [fee ids], skipped: [{ student, reason }] }.
async function raiseGradingFees(applicationIds, dueDate, adminId, describe) {
  return db.transaction(async (q) => {
    const { rows } = await q(APPLICANT_SELECT, [applicationIds]);
    const created = [];
    const skipped = [];
    for (const a of rows) {
      if (!a.target_belt) { skipped.push({ student: a.student, reason: 'Already on the top belt of the ladder.' }); continue; }
      if (a.grading_fee == null) { skipped.push({ student: a.student, reason: `No grading fee is set for ${a.target_belt}.` }); continue; }
      const fee = await q(
        `INSERT INTO fees (student_id, description, amount, due_date, status, grading_application_id, created_by, created_at)
         VALUES ($1, $2, $3, $4::date, 'unpaid', $5, $6, now()) RETURNING id`,
        [a.student_id, describe(a), a.grading_fee, dueDate, a.application_id, adminId]
      );
      created.push(fee.rows[0].id);
    }
    return { created, skipped };
  });
}

// ---------- Other charges ----------

// Raise the same unpaid charge for one or many students. Returns the new fee ids.
async function createCharges(studentIds, description, amount, dueDate, adminId) {
  const { rows } = await db.query(
    `INSERT INTO fees (student_id, description, amount, due_date, status, created_by, created_at)
     SELECT s.id, $2, $3, $4::date, 'unpaid', $5, now()
     FROM students s WHERE s.id = ANY($1::int[])
     RETURNING id`,
    [studentIds, description, amount, dueDate, adminId]
  );
  return rows.map((r) => r.id);
}

// Money taken at the counter: every item becomes a charge that is already paid, with its payment row.
// items: [{ description, amount }]     Returns the new fee ids.
async function recordCounterPayment(studentId, items, method, reference, paidOn, adminId) {
  return db.transaction(async (q) => {
    const ids = [];
    for (const item of items) {
      const fee = await q(
        `INSERT INTO fees (student_id, description, amount, due_date, status, created_by, created_at)
         VALUES ($1, $2, $3, NULL, 'paid', $4, now()) RETURNING id`,
        [studentId, item.description, item.amount, adminId]
      );
      await q(
        `INSERT INTO payments (fee_id, amount, method, reference, paid_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))`,
        [fee.rows[0].id, item.amount, method, reference, paidOn]
      );
      ids.push(fee.rows[0].id);
    }
    return ids;
  });
}

// Mark an unpaid charge as paid and record how. Returns false if it was not unpaid any more.
async function settleFee(id, method, reference, paidOn) {
  return db.transaction(async (q) => {
    const fee = await q(`UPDATE fees SET status = 'paid' WHERE id = $1 AND status = 'unpaid' RETURNING amount`, [id]);
    if (fee.rows.length === 0) return false;
    await q(
      `INSERT INTO payments (fee_id, amount, method, reference, paid_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))`,
      [id, fee.rows[0].amount, method, reference, paidOn]
    );
    return true;
  });
}

// Change the amount / due date of an unpaid charge and log the change. Returns false if it was not unpaid.
async function editFee(id, amount, dueDate, reason, adminId) {
  return db.transaction(async (q) => {
    const before = await q(`SELECT amount, due_date FROM fees WHERE id = $1 AND status = 'unpaid'`, [id]);
    if (before.rows.length === 0) return false;
    await q('UPDATE fees SET amount = $2, due_date = $3::date WHERE id = $1', [id, amount, dueDate]);
    await q(
      `INSERT INTO fee_edits (fee_id, edited_by, old_amount, new_amount, old_due_date, new_due_date, reason)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)`,
      [id, adminId, before.rows[0].amount, amount, before.rows[0].due_date, dueDate, reason]
    );
    return true;
  });
}

// Void an unpaid charge: it stays on record but stops counting. Returns false if it was not unpaid.
async function voidFee(id, reason, adminId) {
  const { rows } = await db.query(
    `UPDATE fees SET status = 'void', void_reason = $2, voided_by = $3, voided_at = now()
     WHERE id = $1 AND status = 'unpaid' RETURNING id`,
    [id, reason, adminId]
  );
  return rows.length > 0;
}

// the admin's password hash, for the "signature" on a void
async function getPasswordHash(userId) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return rows[0] ? rows[0].password_hash : null;
}

module.exports = {
  listFees, getFee, listOptions,
  listGradingApplicants, raiseGradingFees,
  createCharges, recordCounterPayment, settleFee, editFee, voidFee, getPasswordHash,
};
