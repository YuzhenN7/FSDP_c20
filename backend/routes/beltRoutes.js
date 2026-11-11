// BELT LEVELS - ROUTES: which URL goes to which controller function.   Mounted at /api/belts
// Used by: frontend/admin/belts.html and frontend/admin/belts-edit.html   (admin login required)
const express = require('express');
const controller = require('../controllers/beltController');

const router = express.Router();

router.get('/', beltController.listBelts);            // list belt levels, lowest first
router.post('/', beltController.createBelt);          // add a belt level
router.put('/:id', beltController.updateBelt);        // rename a belt level
router.post('/:id/move', beltController.moveBelt);    // move a belt up or down the ladder
router.delete('/:id', beltController.deleteBelt);     // remove a belt level

module.exports = router;