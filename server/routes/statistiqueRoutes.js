const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/statistiqueController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken);
router.get('/dashboard-admin', autoriserRoles('admin'), ctrl.dashboardAdmin);
router.get('/dashboard-utilisateur', ctrl.dashboardUtilisateur);
router.get('/produits-plus-vendus', autoriserRoles('admin'), ctrl.produitsPlusVendus);
router.get('/recherche', autoriserRoles('admin'), ctrl.rechercheIntelligente);
router.get('/comptabilite', autoriserRoles('admin'), ctrl.comptabilite);

module.exports = router;
