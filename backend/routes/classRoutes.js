// CLASSES and SCHEDULING (also venues and instructors) - ROUTES: which URL goes to which controller function.   Mounted at /api/classes
// Used by: frontend/admin/classes.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const classController = require('../controllers/classController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', classController.listClasses);   // list all classes with centre, venue and instructor names
router.get('/venues', classController.listVenues);   // list all venues with their centre
router.get('/instructors', classController.listInstructors);   // list all instructors

router.put('/:id/assign', classController.assignClass);   // SCRUM-18: assign instructor and venue (with clash check)

// TODO: POST /api/classes       -> create a class
// TODO: PUT /api/classes/:id    -> edit a class (name, day, times)
// TODO: DELETE /api/classes/:id -> remove a class
// TODO: POST/PUT/DELETE for /api/classes/venues and /api/classes/instructors

module.exports = router;
