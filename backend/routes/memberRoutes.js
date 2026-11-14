// SCRUM-6: all student record APIs restricted to authenticated administrators.
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/memberController');
const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/options', ctrl.options);
router.get('/', ctrl.listMembers);
router.post('/', ctrl.createMember);
router.put('/:id', ctrl.updateMember);
router.patch('/:id/deactivate', ctrl.deactivateMember);
module.exports = router;
