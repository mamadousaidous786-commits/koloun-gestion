const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservationController');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken); // tous les utilisateurs de Koloun Gestion
router.get('/', ctrl.lister);
router.post('/', ctrl.creer);
router.put('/:id/confirmer', ctrl.confirmer);
router.put('/:id/prolonger', ctrl.prolonger);   // plus de temps pour venir chercher // réservation faite en ligne → stock mis de côté
router.put('/:id/retrait', ctrl.retirer);
router.put('/:id/annuler', ctrl.annuler);

module.exports = router;
