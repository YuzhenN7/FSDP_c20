// FEES (admin) - ROUTES: which URL goes to which controller function.   Mounted at /api/fees
// Used by: frontend/admin/fees.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const feeController = require('../controllers/feeController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', feeController.listFees);   // list all fees with the student name and status

// TODO: POST /api/fees        -> assign a fee { student_id, description, amount, due_date }
// TODO: PUT /api/fees/:id     -> edit a fee
// TODO: DELETE /api/fees/:id  -> remove a fee (only if unpaid)

module.exports = router;
