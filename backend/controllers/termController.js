// SCRUM-17: create terms; assemble weekly timetable; exclude staff-entered holidays.
const model = require('../models/termModel');
const isDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const isId = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0;
const serverError = (err, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'A term with this name already exists.' });
  if (err.code === '23503') return res.status(400).json({ error: 'Choose an existing class and term.' });
  next(err);
};
const handler = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { serverError(err, res, next); } };

const list = handler(async (_, res) => res.json(await model.listTerms()));
const availableClasses = handler(async (_, res) => res.json(await model.listAvailableClasses()));
const holidays = handler(async (_, res) => res.json(await model.listHolidays()));
const create = handler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const start = req.body.start_date, end = req.body.end_date;
  if (!name || name.length > 120 || !isDate(start) || !isDate(end) || end < start) {
    return res.status(400).json({ error: 'Enter a term name and a valid start/end date.' });
  }
  res.status(201).json(await model.createTerm({ name, start_date: start, end_date: end }));
});
const one = handler(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid term.' });
  const term = await model.getTerm(req.params.id);
  if (!term) return res.status(404).json({ error: 'Term not found.' });
  res.json({ ...term, classes: await model.listWeeklyClasses(req.params.id) });
});
const addClass = handler(async (req, res) => {
  if (!isId(req.params.id) || !isId(req.body.class_id)) return res.status(400).json({ error: 'Choose a valid term and class.' });
  if (!await model.getTerm(req.params.id)) return res.status(404).json({ error: 'Term not found.' });
  const result = await model.addClass(req.params.id, req.body.class_id);
  res.status(result ? 201 : 200).json({ added: !!result });
});
const removeClass = handler(async (req, res) => {
  if (!isId(req.params.id) || !isId(req.params.classId)) return res.status(400).json({ error: 'Invalid term or class.' });
  const removed = await model.removeClass(req.params.id, req.params.classId);
  if (!removed) return res.status(404).json({ error: 'Scheduled class not found.' });
  res.json({ removed: true });
});
const calendar = handler(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid term.' });
  if (!await model.getTerm(req.params.id)) return res.status(404).json({ error: 'Term not found.' });
  res.json(await model.calendar(req.params.id));
});
const addHoliday = handler(async (req, res) => {
  const date = req.body.holiday_date;
  const name = String(req.body.name || '').trim();
  if (!isDate(date) || !name || name.length > 150) return res.status(400).json({ error: 'Enter a holiday date and name.' });
  res.status(201).json(await model.addHoliday(date, name));
});
const deleteHoliday = handler(async (req, res) => {
  if (!isDate(req.params.date)) return res.status(400).json({ error: 'Invalid holiday date.' });
  if (!await model.deleteHoliday(req.params.date)) return res.status(404).json({ error: 'Holiday not found.' });
  res.json({ removed: true });
});
module.exports = { list, availableClasses, holidays, create, one, addClass, removeClass, calendar, addHoliday, deleteHoliday };
