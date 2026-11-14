const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const gradingController = require('../controllers/gradingController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', gradingController.listGradings);   

module.exports = router;
