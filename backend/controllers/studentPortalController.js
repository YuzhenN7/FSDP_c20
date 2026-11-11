// STUDENT PORTAL - CONTROLLER: everything here is about the logged-in student only.
const studentPortalModel = require('../models/studentPortalModel');
// const { sendReceiptEmail } = require('../services/emailService');   // use this in payFee once it is built

// Runs before every student route: finds this user's student record and puts it on req.student
async function loadStudent(req, res, next) {
  const student = await studentPortalModel.findStudentByUserId(req.user.id);
  if (!student) return res.status(404).json({ error: 'No student record found for this account.' });
  req.student = student;
  next();
}

// GET /api/student/belt  -> current belt + grading history
async function getBelt(req, res) {
  res.json({
    current: await studentPortalModel.getCurrentBelt(req.student.id),
    history: await studentPortalModel.getGradingHistory(req.student.id),
  });
}

// GET /api/student/fees  -> this student's fees
async function listFees(req, res) {
  res.json(await studentPortalModel.listFees(req.student.id));
}

// GET /api/student/payments  -> this student's payment history
async function listPayments(req, res) {
  res.json(await studentPortalModel.listPayments(req.student.id));
}

// GET /api/student/payments/:id  -> one payment (for the "Payment successful" page)
async function getPayment(req, res) {
  const payment = await studentPortalModel.getPayment(req.student.id, req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });
  res.json(payment);
}

// TODO (online payments): POST /api/student/fees/:id/pay
//   Call studentPortalModel.payFee(...), then sendReceiptEmail(...), then return the new payment
//   so the page can open payment-success.html?id=<payment id>

// POST /api/student/fees/:id/pay -> starts a payment and returns the gateway page address
async function payFee(req, res) {
  const r = await studentPortalModel.createAttempt(req.student.id, req.params.id);
  if (r.error) return res.status(r.code).json({ error: r.error });
  res.status(201).json({ session_id: r.sessionId, checkout_url: `/student/checkout.html?session=${r.sessionId}` });
}

// GET /api/student/checkout/:session -> what the gateway page shows
async function getCheckout(req, res) {
  const attempt = await studentPortalModel.getAttempt(req.student.id, req.params.session);
  if (!attempt) return res.status(404).json({ error: 'Payment session not found.' });
  res.json(attempt);
}

// POST /api/student/checkout/:session/result  { outcome: 'success' | 'fail' }
async function settleCheckout(req, res) {
  const { outcome } = req.body;
  if (!['success', 'fail'].includes(outcome)) return res.status(400).json({ error: 'Invalid outcome.' });
  const existing = await studentPortalModel.getAttempt(req.student.id, req.params.session);
  if (!existing) return res.status(404).json({ error: 'Payment session not found.' });
  const r = await studentPortalModel.settleAttempt(
    req.student.id, req.params.session, outcome, 'Card declined by the bank (simulated)'
  );
  res.json({ status: r.attempt.status, payment_id: r.paymentId, failure_reason: r.attempt.failure_reason });
}

async function payFee(req, res) {
  res.status(501).json({ error: 'Online payment is not built yet.' });
}

module.exports = { 
  loadStudent, 
  getBelt, listFees, 
  listPayments, 
  getPayment, 
  payFee, 
  getCheckout, 
  settleCheckout 
};