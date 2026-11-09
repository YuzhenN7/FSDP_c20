// SCRUM-17: admin-only API. More specific paths must precede '/:id'.
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/termController');
const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/available-classes', c.availableClasses);
router.get('/holidays', c.holidays);
router.post('/holidays', c.addHoliday);
router.delete('/holidays/:date', c.deleteHoliday);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id/calendar', c.calendar);
router.post('/:id/classes', c.addClass);
router.delete('/:id/classes/:classId', c.removeClass);
router.get('/:id', c.one);
module.exports = router;
