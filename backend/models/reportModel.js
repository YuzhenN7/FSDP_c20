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

// filters: { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null, centre_id: number | null }
const args = (f) => [f.from || null, f.to || null, f.centre_id || null];

// every payment, plus failed online attempts (failed ones are listed but never counted as money)
async function getPaymentHistory(f) {
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT p.id, p.paid_at AS at, u.name AS student, fe.description AS fee, p.method,
              'paid' AS status, p.amount::float AS amount, s.centre_id
       FROM payments p
       JOIN fees fe ON fe.id = p.fee_id
       JOIN students s ON s.id = fe.student_id
       JOIN users u ON u.id = s.user_id
       UNION ALL
       SELECT a.id, a.created_at, u.name, fe.description, 'online',
              'failed', a.amount::float, s.centre_id
       FROM payment_attempts a
       JOIN fees fe ON fe.id = a.fee_id
       JOIN students s ON s.id = fe.student_id
       JOIN users u ON u.id = s.user_id
       WHERE a.status = 'failed'
     ) x
     WHERE ($1::date IS NULL OR x.at >= $1::date)
       AND ($2::date IS NULL OR x.at < $2::date + 1)
       AND ($3::int  IS NULL OR x.centre_id = $3::int)
     ORDER BY x.at DESC`,
    args(f)
  );
  return rows;
}

// all students' gradings
async function getGrades(f) {
  const { rows } = await db.query(
    `SELECT g.id, u.name AS student, cb.name AS current_belt, gb.name AS graded_belt,
            g.result, g.graded_on, g.notes
     FROM gradings g
     JOIN students s ON s.id = g.student_id
     JOIN users u ON u.id = s.user_id
     JOIN belt_levels gb ON gb.id = g.belt_id
     LEFT JOIN belt_levels cb ON cb.id = s.belt_id
     WHERE ($1::date IS NULL OR g.graded_on >= $1::date)
       AND ($2::date IS NULL OR g.graded_on < $2::date + 1)
       AND ($3::int  IS NULL OR s.centre_id = $3::int)
     ORDER BY g.graded_on DESC, g.id DESC`,
    args(f)
  );
  return rows;
}

// money actually received, per month
async function getRevenueByMonth(f) {
  const { rows } = await db.query(
    `SELECT to_char(date_trunc('month', p.paid_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS payments,
            COALESCE(SUM(p.amount), 0)::float AS collected
     FROM payments p
     JOIN fees fe ON fe.id = p.fee_id
     JOIN students s ON s.id = fe.student_id
     WHERE ($1::date IS NULL OR p.paid_at >= $1::date)
       AND ($2::date IS NULL OR p.paid_at < $2::date + 1)
       AND ($3::int  IS NULL OR s.centre_id = $3::int)
     GROUP BY 1
     ORDER BY 1 DESC`,
    args(f)
  );
  return rows;
}

// every unpaid fee, oldest due date first (the date filter does not apply: it is "what is owed now")
async function getOutstanding(f) {
  const { rows } = await db.query(
    `SELECT fe.id, u.name AS student, fe.description AS fee, fe.amount::float AS amount,
            fe.due_date,
            GREATEST(CURRENT_DATE - fe.due_date, 0)::int AS days_overdue
     FROM fees fe
     JOIN students s ON s.id = fe.student_id
     JOIN users u ON u.id = s.user_id
     WHERE fe.status = 'unpaid'
       AND ($1::int IS NULL OR s.centre_id = $1::int)
     ORDER BY fe.due_date ASC NULLS LAST, fe.id`,
    [f.centre_id || null]
  );
  return rows;
}

module.exports = { getSummary, getPaymentHistory, getGrades, getRevenueByMonth, getOutstanding };
