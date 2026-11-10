const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/depenseController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.lister);
router.post('/', ctrl.creer);
router.delete('/:id', ctrl.supprimer);

module.exports = router;
