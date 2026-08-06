const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/commandeController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.listerCommandes);
router.post('/', ctrl.creerCommande);
router.put('/:id/transport', ctrl.mettreAJourTransport);
router.put('/:id/montant-realise', ctrl.mettreAJourRentabilite);
router.delete('/:id', ctrl.supprimerCommande);

module.exports = router;
