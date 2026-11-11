const Belt = require('../models/beltModel');

function parseSortOrder(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

exports.list = async (req, res, next) => {
  try {
    res.json(await Belt.getAll());
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const sortOrder = parseSortOrder(req.body.sort_order);
    if (!name) return res.status(400).json({ error: 'Belt name is required.' });
    if (Number.isNaN(sortOrder)) return res.status(400).json({ error: 'Sort order must be a whole number.' });
    res.status(201).json(await Belt.create(name, sortOrder));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That belt name or order already exists.' });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const sortOrder = parseSortOrder(req.body.sort_order);
    if (!name) return res.status(400).json({ error: 'Belt name is required.' });
    if (sortOrder === null || Number.isNaN(sortOrder)) {
      return res.status(400).json({ error: 'Sort order must be a whole number.' });
    }
    const belt = await Belt.update(req.params.id, name, sortOrder);
    if (!belt) return res.status(404).json({ error: 'Belt not found.' });
    res.json(belt);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That belt name or order already exists.' });
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const deleted = await Belt.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Belt not found.' });
    res.json({ message: 'Belt deleted.' });
  } catch (err) {
    // 23503 = a student or grading still uses this belt
    if (err.code === '23503') return res.status(409).json({ error: 'This belt is in use and cannot be deleted.' });
    next(err);
  }
};