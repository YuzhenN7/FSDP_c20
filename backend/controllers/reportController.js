// REPORTS and DASHBOARD numbers - CONTROLLER: reads the request, calls the model, sends the answer.
const reportModel = require('../models/reportModel');
const { priceBreakdown } = require('../utils/feeCalculator');

async function getSummary(req, res) {
  res.json(await reportModel.getSummary());
}

// only accept dates like 2026-11-13 (anything else is ignored instead of crashing the query)
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// everything the Reports page shows, in one answer
async function overview(req, res) {
  const f = {
    from: isDate(req.query.from) ? req.query.from : null,
    to: isDate(req.query.to) ? req.query.to : null,
    centre_id: Number(req.query.centre_id) || null,
  };
  const [payments, grades, revenue, owed] = await Promise.all([
    reportModel.getPaymentHistory(f),
    reportModel.getGrades(f),
    reportModel.getRevenueByMonth(f),
    reportModel.getOutstanding(f),
  ]);
  // what the student really has to pay (fee + GST), same as the student's My fees page
  const outstanding = owed.map((r) => ({ ...r, total: priceBreakdown(r.amount, 0).final }));
  const summary = {
    collected: revenue.reduce((s, r) => s + r.collected, 0),
    outstanding_total: outstanding.reduce((s, r) => s + r.total, 0),
    overdue_count: outstanding.filter((r) => r.days_overdue > 0).length,
    failed_count: payments.filter((p) => p.status === 'failed').length,
  };
  res.json({ summary, payments, grades, revenue, outstanding });
}

module.exports = { getSummary, overview};
