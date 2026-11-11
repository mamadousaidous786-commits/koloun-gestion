const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/groupeCommandeController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.lister);
router.post('/', ctrl.creer);
router.put('/:id/transport', ctrl.validerTransport);
router.delete('/:id', ctrl.supprimer);

module.exports = router;
