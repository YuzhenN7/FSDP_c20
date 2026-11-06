// ATTENDANCE (admin) - ROUTES: which URL goes to which controller function.   Mounted at /api/attendance
// Used by: frontend/admin/attendance.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', attendanceController.listAttendance);   // list attendance records, newest first

// TODO: POST /api/attendance  -> mark a student present/absent for a class on a date { class_id, student_id, class_date, status }

module.exports = router;
