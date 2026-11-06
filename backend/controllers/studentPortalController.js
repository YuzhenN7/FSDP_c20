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
async function payFee(req, res) {
  res.status(501).json({ error: 'Online payment is not built yet.' });
}

module.exports = { loadStudent, getBelt, listFees, listPayments, getPayment, payFee };
