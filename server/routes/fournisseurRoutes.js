const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fournisseurController');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);
router.get('/fournisseurs', ctrl.lister);
router.post('/fournisseurs', ctrl.creer);
router.put('/fournisseurs/:id', ctrl.modifier);
router.delete('/fournisseurs/:id', ctrl.supprimer);

module.exports = router;
