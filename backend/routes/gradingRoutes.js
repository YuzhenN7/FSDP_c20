// GRADING RESULTS - ROUTES: which URL goes to which controller function.   Mounted at /api/gradings
// Used by: frontend/admin/grading.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const gradingController = require('../controllers/gradingController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', gradingController.listGradings);                          // results history (filters: session_id, result, search)
router.get('/sessions', gradingController.listSessions);                  // sessions with approved candidates
router.get('/sessions/:id', gradingController.getSession);                // one session: panel + candidates still to record
router.post('/sessions/:id/results', gradingController.recordResults);    // save results; a pass moves the belt up
router.get('/examiners', gradingController.listExaminers);                // instructors, examiners first
router.get('/promotions', gradingController.listPromotions);              // promotion log
router.get('/:id/belt-check', gradingController.beltCheck);               // what an edit would do to the belt
router.put('/:id', gradingController.editGrading);                        // change a saved result (logged)

module.exports = router;
