const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/commandeSpecialeController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifierToken);
router.get('/', ctrl.lister);
router.post('/', upload.single('image'), ctrl.creer);
router.put('/:id', upload.single('image'), ctrl.modifier);
router.put('/:id/statut', ctrl.changerStatut);
router.get('/:id/recu', ctrl.recu);
router.post('/:id/paiements', ctrl.ajouterPaiement);
router.delete('/:id/paiements/:paiementId', autoriserRoles('admin'), ctrl.supprimerPaiement);
router.delete('/:id', autoriserRoles('admin'), ctrl.supprimer);

module.exports = router;
