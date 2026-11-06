// STUDENT PORTAL - ROUTES (student login required).   Mounted at /api/student
// Used by: frontend/student/*.html
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const portal = require('../controllers/studentPortalController');

const router = express.Router();
router.use(requireAuth, requireRole('student'), portal.loadStudent);

router.get('/belt', portal.getBelt);                 // current belt + grading history
router.get('/fees', portal.listFees);                // this student's fees
router.get('/payments', portal.listPayments);        // payment history
router.get('/payments/:id', portal.getPayment);      // one payment (success page / receipt)
router.post('/fees/:id/pay', portal.payFee);         // TODO: online payment

module.exports = router;
