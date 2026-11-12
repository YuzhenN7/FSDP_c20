const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/feePackageController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/active', ctrl.setActive);

module.exports = router;