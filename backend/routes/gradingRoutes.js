const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const gradingController = require('../controllers/gradingController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', gradingController.listGradings);   

// TODO: POST /api/gradings  -> record a result { student_id, belt_id, result, graded_on, notes }
// TODO:                        if result is 'pass', also update students.belt_id for that student

module.exports = router;
