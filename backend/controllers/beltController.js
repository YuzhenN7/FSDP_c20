// BELT LEVELS - CONTROLLER: reads the request, calls the model, sends the answer.
const beltModel = require('../models/beltModel');

const TRACKS = ['adult', 'junior'];

// whole number or null (null = not given); NaN = given but invalid
function parseOrder(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

// Grading fee: undefined = not sent (leave as it is), null = no fee, a number >= 0, or NaN = invalid
function parseFee(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

async function listBelts(req, res) {
  res.json(await beltModel.listBelts());
}

async function createBelt(req, res) {
  const name = String(req.body.name || '').trim();
  const sortOrder = parseOrder(req.body.sort_order);
  const track = req.body.track === undefined ? 'adult' : req.body.track;
  const fee = parseFee(req.body.grading_fee);
  if (!name) return res.status(400).json({ error: 'Belt name is required.' });
  if (Number.isNaN(sortOrder)) return res.status(400).json({ error: 'Order must be a whole number.' });
  if (!TRACKS.includes(track)) return res.status(400).json({ error: 'Ladder must be adult or junior.' });
  if (Number.isNaN(fee)) return res.status(400).json({ error: 'Grading fee must be a number, 0 or more.' });
  try {
    res.status(201).json(await beltModel.createBelt(name, sortOrder, track, fee === undefined ? null : fee));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That belt name or order already exists.' });
    throw err;
  }
}

async function updateBelt(req, res) {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const sortOrder = parseOrder(req.body.sort_order);
  const fee = parseFee(req.body.grading_fee);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid belt id.' });
  if (!name) return res.status(400).json({ error: 'Belt name is required.' });
  if (sortOrder === null || Number.isNaN(sortOrder)) {
    return res.status(400).json({ error: 'Order must be a whole number.' });
  }
  if (Number.isNaN(fee)) return res.status(400).json({ error: 'Grading fee must be a number, 0 or more.' });
  try {
    const belt = await beltModel.updateBelt(id, name, sortOrder, fee);
    if (!belt) return res.status(404).json({ error: 'Belt not found.' });
    res.json(belt);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That belt name or order already exists.' });
    throw err;
  }
}

async function moveBelt(req, res) {
  const id = Number(req.params.id);
  const direction = req.body.direction;
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid belt id.' });
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be up or down.' });
  }
  const result = await beltModel.moveBelt(id, direction);
  if (result === null) return res.status(404).json({ error: 'Belt not found.' });
  res.json({ message: 'Moved.' });
}

async function deleteBelt(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid belt id.' });
  try {
    const belt = await beltModel.deleteBelt(id);
    if (!belt) return res.status(404).json({ error: 'Belt not found.' });
    res.json({ message: 'Belt deleted.' });
  } catch (err) {
    // 23503: a student or grading still uses this belt
    if (err.code === '23503') return res.status(409).json({ error: 'This belt is in use and cannot be deleted.' });
    throw err;
  }
}

module.exports = { listBelts, createBelt, updateBelt, moveBelt, deleteBelt };
