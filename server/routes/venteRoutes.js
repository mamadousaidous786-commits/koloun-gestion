const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/venteController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken);
router.get('/', ctrl.listerVentes);
router.get('/:id', ctrl.obtenirVente);
router.post('/', ctrl.creerVente);
router.delete('/:id', autoriserRoles('admin'), ctrl.supprimerVente);

module.exports = router;
