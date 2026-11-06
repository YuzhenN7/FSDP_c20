// CLASSES and SCHEDULING (also venues and instructors) - MODEL: the database queries. (Controllers call these; routes never touch the database.)
const db = require('../config/db');

// list all classes with centre, venue and instructor names
async function listClasses() {
  const { rows } = await db.query(
    `SELECT cl.id, cl.name, c.name AS centre, v.name AS venue, i.name AS instructor,
            cl.day_of_week, cl.start_time, cl.end_time
     FROM classes cl
     JOIN centres c ON c.id = cl.centre_id
     LEFT JOIN venues v ON v.id = cl.venue_id
     LEFT JOIN instructors i ON i.id = cl.instructor_id
     ORDER BY c.name, cl.day_of_week, cl.start_time`
  );
  return rows;
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

// TODO: POST /api/classes       -> create a class
// TODO: PUT /api/classes/:id    -> edit a class (including assigning instructor_id and venue_id)
// TODO: DELETE /api/classes/:id -> remove a class
// TODO: POST/PUT/DELETE for /api/classes/venues and /api/classes/instructors

module.exports = { listClasses, listVenues, listInstructors };
