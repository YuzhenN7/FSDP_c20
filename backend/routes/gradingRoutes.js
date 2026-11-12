<<<<<<< HEAD
=======
// GRADING RESULTS - ROUTES: which URL goes to which controller function.   Mounted at /api/gradings
// Used by: frontend/admin/grading.html   (admin login required)
>>>>>>> 70f386660e8bd22d0cde5fd913ba239ee883fa3a
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const gradingController = require('../controllers/gradingController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

<<<<<<< HEAD
router.get('/', gradingController.listGradings);   
=======
router.get('/', gradingController.listGradings);   // list grading results, newest first
>>>>>>> 70f386660e8bd22d0cde5fd913ba239ee883fa3a

// TODO: POST /api/gradings  -> record a result { student_id, belt_id, result, graded_on, notes }
// TODO:                        if result is 'pass', also update students.belt_id for that student

module.exports = router;
