// SCRUM-17: terms select existing weekly classes; holidays suppress class instances.
const db = require('../config/db');

async function listTerms() {
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.start_date, t.end_date,
            COUNT(tc.class_id)::int AS weekly_class_count
       FROM terms t LEFT JOIN term_class_schedule tc ON tc.term_id = t.id
      GROUP BY t.id ORDER BY t.start_date DESC, t.id DESC`
  );
  return rows;
}
async function getTerm(id) {
  const { rows } = await db.query('SELECT id, name, start_date, end_date FROM terms WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createTerm({ name, start_date, end_date }) {
  const { rows } = await db.query(
    `INSERT INTO terms (name, start_date, end_date) VALUES ($1, $2::date, $3::date)
     RETURNING id, name, start_date, end_date`, [name, start_date, end_date]
  );
  return rows[0];
}
async function listWeeklyClasses(id) {
  const { rows } = await db.query(
    `SELECT cl.id AS class_id, cl.name, cl.day_of_week, cl.start_time, cl.end_time,
            c.name AS centre, v.name AS venue, i.name AS instructor
       FROM term_class_schedule tc JOIN classes cl ON cl.id = tc.class_id
       JOIN centres c ON c.id = cl.centre_id
       LEFT JOIN venues v ON v.id = cl.venue_id
       LEFT JOIN instructors i ON i.id = cl.instructor_id
      WHERE tc.term_id = $1 ORDER BY cl.day_of_week, cl.start_time, cl.name`, [id]
  );
  return rows;
}
async function listAvailableClasses() {
  const { rows } = await db.query(
    `SELECT cl.id, cl.name, cl.day_of_week, cl.start_time, cl.end_time,
            c.name AS centre FROM classes cl
       JOIN centres c ON c.id = cl.centre_id ORDER BY c.name, cl.day_of_week, cl.start_time`, []
  );
  return rows;
}
async function addClass(termId, classId) {
  const { rows } = await db.query(
    `INSERT INTO term_class_schedule (term_id, class_id) VALUES ($1, $2)
     ON CONFLICT (term_id, class_id) DO NOTHING RETURNING term_id, class_id`, [termId, classId]
  );
  return rows[0] || null;
}
async function removeClass(termId, classId) {
  const { rows } = await db.query(
    `DELETE FROM term_class_schedule WHERE term_id = $1 AND class_id = $2 RETURNING class_id`, [termId, classId]
  );
  return rows.length > 0;
}
async function listHolidays() {
  const { rows } = await db.query('SELECT holiday_date, name FROM public_holidays ORDER BY holiday_date');
  return rows;
}
async function addHoliday(date, name) {
  const { rows } = await db.query(
    `INSERT INTO public_holidays (holiday_date, name) VALUES ($1::date, $2)
     ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name
     RETURNING holiday_date, name`, [date, name]
  );
  return rows[0];
}
async function deleteHoliday(date) {
  const { rows } = await db.query('DELETE FROM public_holidays WHERE holiday_date = $1::date RETURNING holiday_date', [date]);
  return rows.length > 0;
}
async function calendar(id) {
  const { rows } = await db.query(
    `SELECT to_char(day_instance.class_day, 'YYYY-MM-DD') AS class_date,
            cl.id AS class_id, cl.name, c.name AS centre,
            cl.day_of_week, cl.start_time, cl.end_time,
            v.name AS venue, i.name AS instructor
       FROM term_class_schedule tc
       JOIN terms t ON t.id = tc.term_id
       JOIN classes cl ON cl.id = tc.class_id
       JOIN centres c ON c.id = cl.centre_id
       LEFT JOIN venues v ON v.id = cl.venue_id
       LEFT JOIN instructors i ON i.id = cl.instructor_id
       CROSS JOIN LATERAL generate_series(t.start_date::timestamp, t.end_date::timestamp, INTERVAL '1 day')
            AS day_instance(class_day)
       LEFT JOIN public_holidays h ON h.holiday_date = day_instance.class_day::date
      WHERE t.id = $1 AND h.holiday_date IS NULL
        AND trim(to_char(day_instance.class_day, 'Day')) = cl.day_of_week
      ORDER BY day_instance.class_day, cl.start_time, cl.id`, [id]
  );
  return rows;
}
module.exports = { listTerms, getTerm, createTerm, listWeeklyClasses, listAvailableClasses,
  addClass, removeClass, listHolidays, addHoliday, deleteHoliday, calendar };
