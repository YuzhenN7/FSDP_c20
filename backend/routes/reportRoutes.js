// REPORTS and DASHBOARD numbers - ROUTES: which URL goes to which controller function.   Mounted at /api/reports
// Used by: frontend/admin/dashboard.html and reports.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/summary', reportController.getSummary);   // headline numbers for the dashboard

// TODO: more reports, e.g. GET /api/reports/payments-by-centre, GET /api/reports/outstanding-fees

module.exports = router;
