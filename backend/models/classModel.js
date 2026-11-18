// CLASSES and SCHEDULING (also venues and instructors) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// One class with its centre, venue and instructor names (shared by the queries below)
const CLASS_SELECT = `
  SELECT cl.id, cl.name, cl.centre_id, c.name AS centre,
         cl.venue_id, v.name AS venue, cl.instructor_id, i.name AS instructor,
         cl.day_of_week, cl.start_time, cl.end_time
  FROM classes cl
  JOIN centres c ON c.id = cl.centre_id
  LEFT JOIN venues v ON v.id = cl.venue_id
  LEFT JOIN instructors i ON i.id = cl.instructor_id`;

// list all classes with centre, venue and instructor names
async function listClasses() {
  const { rows } = await db.query(`${CLASS_SELECT} ORDER BY c.name, cl.day_of_week, cl.start_time`);
  return rows;
}

// one class (undefined if the id does not exist)
async function getClass(id) {
  const { rows } = await db.query(`${CLASS_SELECT} WHERE cl.id = $1`, [id]);
  return rows[0];
}

// list all venues with their centre
async function listVenues() {
  const { rows } = await db.query(
    `SELECT v.id, v.name, v.centre_id, c.name AS centre
     FROM venues v
     JOIN centres c ON c.id = v.centre_id
     ORDER BY c.name, v.name`
  );
  return rows;
}

// one venue (undefined if the id does not exist)
async function getVenue(id) {
  const { rows } = await db.query('SELECT id, name, centre_id FROM venues WHERE id = $1', [id]);
  return rows[0];
}

// list all instructors
async function listInstructors() {
  const { rows } = await db.query(
    `SELECT i.id, i.name, i.email, i.centre_id, c.name AS centre
     FROM instructors i
     LEFT JOIN centres c ON c.id = i.centre_id
     ORDER BY i.name`
  );
  return rows;
}

// one instructor (undefined if the id does not exist)
async function getInstructor(id) {
  const { rows } = await db.query('SELECT id, name FROM instructors WHERE id = $1', [id]);
  return rows[0];
}

// SCRUM-18: the OTHER classes that would be double-booked if this class used this instructor / venue.
// A clash = same day of the week, the times overlap, and the same instructor or the same venue.
// (A class that ends at 17:00 does not clash with one that starts at 17:00.)
async function findClashes(classId, instructorId, venueId) {
  const { rows } = await db.query(
    `SELECT o.id, o.name, c.name AS centre, o.day_of_week, o.start_time, o.end_time,
            (o.instructor_id = $2) AS same_instructor,
            (o.venue_id = $3)      AS same_venue
     FROM classes me
     JOIN classes o ON o.id <> me.id
                   AND o.day_of_week = me.day_of_week
                   AND o.start_time < me.end_time
                   AND o.end_time > me.start_time
     JOIN centres c ON c.id = o.centre_id
     WHERE me.id = $1
       AND (o.instructor_id = $2 OR o.venue_id = $3)
     ORDER BY o.start_time`,
    [classId, instructorId, venueId]
  );
  return rows;
}

// SCRUM-18: save the instructor and venue of a class (null = not assigned)
async function assignClass(id, instructorId, venueId) {
  await db.query('UPDATE classes SET instructor_id = $2, venue_id = $3 WHERE id = $1', [id, instructorId, venueId]);
  return getClass(id);
}

// SCRUM-18: clash check for a NEW class (not in the database yet), using its day and times directly.
// Same rule as findClashes: same day, overlapping times, and the same instructor or the same venue.
async function findSlotClashes(day, startTime, endTime, instructorId, venueId) {
  const { rows } = await db.query(
    `SELECT o.id, o.name, c.name AS centre, o.day_of_week, o.start_time, o.end_time,
            (o.instructor_id = $4) AS same_instructor,
            (o.venue_id = $5)      AS same_venue
     FROM classes o
     JOIN centres c ON c.id = o.centre_id
     WHERE o.day_of_week = $1
       AND o.start_time < $3::time
       AND o.end_time > $2::time
       AND (o.instructor_id = $4 OR o.venue_id = $5)
     ORDER BY o.start_time`,
    [day, startTime, endTime, instructorId, venueId]
  );
  return rows;
}

// create a class and return it with its centre, venue and instructor names
async function createClass({ centreId, name, day, startTime, endTime, instructorId, venueId }) {
  const { rows } = await db.query(
    `INSERT INTO classes (centre_id, name, day_of_week, start_time, end_time, instructor_id, venue_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [centreId, name, day, startTime, endTime, instructorId, venueId]
  );
  return getClass(rows[0].id);
}

// delete a class (its term links are removed too: ON DELETE CASCADE). Returns false if it did not exist.
async function deleteClass(id) {
  const { rows } = await db.query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

// TODO: PUT /api/classes/:id    -> edit a class (name, day, times)
// TODO: POST/PUT/DELETE for /api/classes/venues and /api/classes/instructors

module.exports = {
  listClasses, getClass, listVenues, getVenue, listInstructors, getInstructor, findClashes, assignClass,
  findSlotClashes, createClass, deleteClass,
};