// FEE PACKAGES - CONTROLLER: checks the input, works out prices on the server, calls the model
const model = require('../models/feePackageModel');
const { priceBreakdown } = require('../utils/feeCalculator');

const GROUPS = ['Adult', 'Children', 'All'];

// package price = sum of its fee prices, less the package discount, plus GST
function withPrice(p) {
  const sub = p.items.reduce((s, i) => s + Number(i.base_amount), 0);
  return { ...p, price: priceBreakdown(sub, Number(p.discount_percent)).final };
}

function validate(b) {
  const name = (b.name || '').trim();
  if (!name) return { error: 'Package name is required.' };
  if (!GROUPS.includes(b.student_group)) return { error: 'Choose a student group.' };
  const discount = Number(b.discount_percent || 0);
  if (!(discount >= 0 && discount <= 100)) return { error: 'Discount must be between 0 and 100.' };
  const ids = [...new Set((b.fee_type_ids || []).map(Number))].filter((n) => Number.isInteger(n));
  if (ids.length === 0) return { error: 'Select at least one fee.' };
  return {
    data: {
      name, student_group: b.student_group, discount_percent: discount,
      validity: String(b.validity || '6 months').slice(0, 40),
      description: (b.description || '').trim(), is_active: b.is_active !== false,
      fee_type_ids: ids,
    },
  };
}

function fail(res, err) {
  if (err.code === '23505') return res.status(409).json({ error: 'A package with this name already exists.' });
  throw err;
}

async function list(req, res) {
  res.json((await model.listPackages()).map(withPrice));
}

async function create(req, res) {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  if ((await model.countPackable(v.data.fee_type_ids)) !== v.data.fee_type_ids.length) {
    return res.status(400).json({ error: 'One or more fees cannot be included in a package.' });
  }
  try { res.status(201).json({ id: await model.createPackage(v.data) }); } catch (err) { fail(res, err); }
}

async function update(req, res) {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  if ((await model.countPackable(v.data.fee_type_ids)) !== v.data.fee_type_ids.length) {
    return res.status(400).json({ error: 'One or more fees cannot be included in a package.' });
  }
  try {
    const row = await model.updatePackage(req.params.id, v.data);
    if (!row) return res.status(404).json({ error: 'Package not found.' });
    res.json({ id: row.id });
  } catch (err) { fail(res, err); }
}

async function setActive(req, res) {
  const row = await model.setActive(req.params.id, req.body.is_active === true);
  if (!row) return res.status(404).json({ error: 'Package not found.' });
  res.json({ id: row.id });
}

module.exports = { list, create, update, setActive };