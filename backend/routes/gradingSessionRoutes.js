const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loadStudent } = require('../controllers/studentPortalController');
const c = require('../controllers/gradingSessionController');

const router = express.Router();
router.use(requireAuth);

router.get('/', c.listSessions);
router.post('/', requireRole('admin'), c.createSession);

router.get('/mine', requireRole('student'), loadStudent, c.myApplications);
router.get('/:id/eligibility', requireRole('student'), loadStudent, c.checkEligibility);
router.post('/:id/apply', requireRole('student'), loadStudent, c.apply);

router.get('/applications', requireRole('admin'), c.listApplications);
router.patch('/applications/:id', requireRole('admin'), c.reviewApplication);

module.exports = router;