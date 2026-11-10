const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/detteController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

// Les dettes concernent l'argent de la boutique : réservé à l'administrateur
router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.lister);
router.post('/', ctrl.creer);
router.put('/:id', ctrl.modifier);
router.post('/:id/paiements', ctrl.ajouterPaiement);
router.delete('/:id/paiements/:paiementId', ctrl.supprimerPaiement);
router.delete('/:id', ctrl.supprimer);

module.exports = router;
