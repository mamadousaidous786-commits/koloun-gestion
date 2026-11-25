const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/agentController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken);
router.get('/etat', ctrl.etat);
router.get('/demandes', ctrl.demandes);
router.put('/demandes/:id', ctrl.traiterDemande);
// Page de test : réservée à l'administrateur (chaque message de test coûte quelques centimes)
router.post('/test', autoriserRoles('admin'), ctrl.tester);
router.post('/test/reprendre', autoriserRoles('admin'), ctrl.rendreLaMain);

module.exports = router;
