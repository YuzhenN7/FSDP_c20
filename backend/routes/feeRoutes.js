// FEES (admin) - ROUTES: which URL goes to which controller function.   Mounted at /api/fees
// Used by: frontend/admin/fees.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const feeController = require('../controllers/feeController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', feeController.listFees);                              // list charges (filters: centre_id, status, search)
router.get('/options', feeController.listOptions);                    // centres, students, fee types and packages for the forms
router.get('/grading-applicants', feeController.listGradingApplicants);   // approved grading applications not charged yet

router.post('/', feeController.createCharges);                        // raise a charge for one or many students (late fee)
router.post('/grading', feeController.raiseGradingFees);              // raise grading fees in bulk, by the grade tested for
router.post('/counter', feeController.recordCounterPayment);          // money taken at the dojo: charge + payment in one step

router.post('/:id/settle', feeController.settleFee);                  // mark an unpaid charge as paid
router.put('/:id', feeController.editFee);                            // change amount / due date of an unpaid charge (logged)
router.post('/:id/void', feeController.voidFee);                      // void an unpaid charge (reason + password)

module.exports = router;
