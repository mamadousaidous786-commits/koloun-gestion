const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurController');
const { register } = require('../controllers/authController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.listerUtilisateurs);
router.post('/', register);
router.put('/:id', ctrl.modifierUtilisateur);
router.put('/:id/statut', ctrl.changerStatut);
router.delete('/:id', ctrl.supprimerUtilisateur);

module.exports = router;
