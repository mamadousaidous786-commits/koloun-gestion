const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/produitController');
const { verifierToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifierToken);
router.get('/', ctrl.listerProduits);
router.get('/:id', ctrl.obtenirProduit);
router.post('/', upload.array('images', 6), ctrl.creerProduit);
router.put('/:id', upload.array('images', 6), ctrl.modifierProduit);
router.post('/:id/dupliquer', ctrl.dupliquerProduit);
router.delete('/:id', ctrl.supprimerProduit);
router.post('/tailles/:id/stock', ctrl.mouvementStock);

module.exports = router;
