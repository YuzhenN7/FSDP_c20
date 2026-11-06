// MEMBERS = STUDENTS (admin view) - ROUTES: which URL goes to which controller function.   Mounted at /api/members
// Used by: frontend/admin/members.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const memberController = require('../controllers/memberController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', memberController.listMembers);   // list all students with centre and current belt

// TODO: PUT /api/members/:id  -> edit a student (e.g. assign a centre)

module.exports = router;
