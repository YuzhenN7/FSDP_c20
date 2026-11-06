// BELT LEVELS - ROUTES: which URL goes to which controller function.   Mounted at /api/belts
// Used by: frontend/admin/belts.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const beltController = require('../controllers/beltController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', beltController.listBelts);   // list belt levels, lowest first

// TODO: POST /api/belts        -> add a belt level
// TODO: PUT /api/belts/:id     -> rename / reorder a belt level
// TODO: DELETE /api/belts/:id  -> remove a belt level

module.exports = router;
