// REPORTS and DASHBOARD numbers - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// headline numbers for the dashboard
async function getSummary() {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM centres)  AS centres,
       (SELECT COUNT(*)::int FROM students) AS students,
       (SELECT COUNT(*)::int FROM classes)  AS classes,
       (SELECT COALESCE(SUM(amount), 0)::float FROM fees WHERE status = 'paid')   AS paid_total,
       (SELECT COALESCE(SUM(amount), 0)::float FROM fees WHERE status = 'unpaid') AS unpaid_total`
  );
  return rows[0];
}

// TODO: more reports, e.g. GET /api/reports/payments-by-centre, GET /api/reports/outstanding-fees

module.exports = { getSummary };
