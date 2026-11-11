const express = require('express');
const controller = require('../controllers/beltController');

const router = express.Router();

// TODO: once Sherie's login (SCRUM-5) is merged, restrict this to the admin, e.g.
// router.use(auth, roleCheck('admin'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;