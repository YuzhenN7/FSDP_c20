// CLASSES and SCHEDULING (also venues and instructors) - CONTROLLER: reads the request, calls the model, sends the answer.
const classModel = require('../models/classModel');

async function listClasses(req, res) {
  res.json(await classModel.listClasses());
}

async function listVenues(req, res) {
  res.json(await classModel.listVenues());
}

async function listInstructors(req, res) {
  res.json(await classModel.listInstructors());
}

// null / '' / missing = "not assigned" (null).  A whole number = that id.  Anything else = NaN (invalid).
function parseId(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

// "Saturday 16:00 - 17:00"
function when(c) {
  return `${c.day_of_week} ${String(c.start_time).slice(0, 5)} - ${String(c.end_time).slice(0, 5)}`;
}

// SCRUM-18   PUT /api/classes/:id/assign   { instructor_id, venue_id }   (null = not assigned)
// Saves the instructor and venue of a class. Refuses (409) if that would double-book either of them,
// and the error message names the class they are already booked for.
async function assignClass(req, res) {
  const id = parseId(req.params.id);
  const instructorId = parseId(req.body.instructor_id);
  const venueId = parseId(req.body.venue_id);
  if (!id) return res.status(400).json({ error: 'Invalid class id.' });
  if (Number.isNaN(instructorId)) return res.status(400).json({ error: 'Invalid instructor.' });
  if (Number.isNaN(venueId)) return res.status(400).json({ error: 'Invalid venue.' });

  const cls = await classModel.getClass(id);
  if (!cls) return res.status(404).json({ error: 'Class not found.' });

  const instructor = instructorId ? await classModel.getInstructor(instructorId) : null;
  if (instructorId && !instructor) return res.status(400).json({ error: 'That instructor does not exist.' });

  const venue = venueId ? await classModel.getVenue(venueId) : null;
  if (venueId && !venue) return res.status(400).json({ error: 'That venue does not exist.' });
  if (venue && venue.centre_id !== cls.centre_id) {
    return res.status(400).json({ error: `${venue.name} is not a venue at ${cls.centre}.` });
  }

  // Clash check: is this instructor or venue already booked at an overlapping time?
  const clashes = await classModel.findClashes(id, instructorId, venueId);
  if (clashes.length > 0) {
    const conflicts = [];
    for (const c of clashes) {
      const booking = `"${c.name}" at ${c.centre} (${when(c)})`;
      if (c.same_instructor) conflicts.push(`${instructor.name} is already teaching ${booking}.`);
      if (c.same_venue) conflicts.push(`${venue.name} is already booked for ${booking}.`);
    }
    return res.status(409).json({ error: 'Clash: ' + conflicts.join(' '), conflicts });
  }

  res.json(await classModel.assignClass(id, instructorId, venueId));
}

module.exports = { listClasses, listVenues, listInstructors, assignClass };