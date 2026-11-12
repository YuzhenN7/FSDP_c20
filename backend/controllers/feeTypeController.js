const feeTypeModel = require('../models/feeTypeModel');
const { priceBreakdown } = require('../utils/feeCalculator');

const CATEGORIES = ['registration', 'membership', 'class_package', 'grading', 'late_fee', 'other'];
const GROUPS = ['Adult', 'Children', 'All'];
const SEPARATE = ['grading', 'late_fee']; // never allowed inside a package

// Checks what the browser sent. Returns { error } or { data }.
function validate(body) {
  const name = String(body.name || '').trim();
  const category = body.category || 'other';
  const student_group = body.student_group || 'All';
  const base_amount = body.base_amount === '' || body.base_amount == null ? null : Number(body.base_amount);
  const discount_percent = Number(body.discount_percent || 0);

  if (!name) return { error: 'Fee name is required.' };
  if (!CATEGORIES.includes(category)) return { error: 'Unknown fee type.' };
  if (!GROUPS.includes(student_group)) return { error: 'Unknown student group.' };
  if (base_amount === null && category !== 'grading') return { error: 'Fee amount is required.' };
  if (base_amount !== null && !(base_amount > 0)) return { error: 'Fee amount must be more than 0.' };
  if (!(discount_percent >= 0 && discount_percent <= 100)) return { error: 'Discount must be between 0 and 100.' };

  return {
    data: {
      name, category, student_group, base_amount, discount_percent,
      can_be_in_package: SEPARATE.includes(category) ? false : body.can_be_in_package !== false,
      description: body.description || null,
      is_active: body.is_active !== false,
    },
  };
}

// Adds the worked-out price (discount, GST, final) to a row, so the page just shows it.
function withPrice(row) {
  if (row.base_amount === null) return { ...row, price: null };
  return { ...row, price: priceBreakdown(Number(row.base_amount), Number(row.discount_percent)) };
}

function fail(res, err, fallback) {
  if (err.code === '23505') return res.status(409).json({ error: 'A fee with this name already exists.' });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

async function list(req, res) {
  try {
    const rows = await feeTypeModel.listFeeTypes();
    res.json(rows.map(withPrice));
  } catch (err) {
    fail(res, err, 'Could not load fee types.');
  }
}

async function create(req, res) {
  const { error, data } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const row = await feeTypeModel.createFeeType(data);
    res.status(201).json(withPrice(row));
  } catch (err) {
    fail(res, err, 'Could not save the fee.');
  }
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid fee id.' });
  const { error, data } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const row = await feeTypeModel.updateFeeType(id, data);
    if (!row) return res.status(404).json({ error: 'Fee not found.' });
    res.json(withPrice(row));
  } catch (err) {
    fail(res, err, 'Could not update the fee.');
  }
}

async function setActive(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid fee id.' });
  try {
    const row = await feeTypeModel.setActive(id, req.body && req.body.is_active === true);
    if (!row) return res.status(404).json({ error: 'Fee not found.' });
    res.json(withPrice(row));
  } catch (err) {
    fail(res, err, 'Could not change the fee status.');
  }
}

module.exports = { list, create, update, setActive };