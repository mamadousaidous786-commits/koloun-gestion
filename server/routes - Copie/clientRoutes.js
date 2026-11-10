const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clientController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken);
router.get('/', ctrl.lister);
router.get('/:id', ctrl.obtenir);
router.post('/', ctrl.creer);
router.put('/:id', ctrl.modifier);
router.delete('/:id', autoriserRoles('admin'), ctrl.supprimer);

module.exports = router;
