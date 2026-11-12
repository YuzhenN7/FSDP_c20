// PAYMENTS (admin view / payment tracking) - ROUTES: which URL goes to which controller function.   Mounted at /api/payments
// Used by: frontend/admin/payments.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', paymentController.listPayments);   // list all payments, newest first

// TODO: filters (by centre, date range, student) for payment tracking

module.exports = router;
