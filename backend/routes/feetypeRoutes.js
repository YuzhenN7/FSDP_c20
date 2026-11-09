// FEE TYPES (admin) - ROUTES: which URL goes to which controller function.   Mounted at /api/fee-types
// Used by: frontend/admin/fee-setup.html   (admin login required)
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/feeTypeController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', ctrl.list);                  // list all fee types
router.post('/', ctrl.create);               // add a fee type
router.put('/:id', ctrl.update);             // edit a fee type
router.patch('/:id/active', ctrl.setActive); // activate or deactivate

module.exports = router;