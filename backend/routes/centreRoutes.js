// CENTRES - ROUTES: which URL goes to which controller function.   Mounted at /api/centres
// Used by: frontend/admin/centres.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const centreController = require('../controllers/centreController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', centreController.listCentres);   // list all centres

// TODO: POST /api/centres        -> add a centre
// TODO: PUT /api/centres/:id     -> edit a centre
// TODO: DELETE /api/centres/:id  -> remove a centre

module.exports = router;
