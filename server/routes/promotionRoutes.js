// Promotions (prix barré dans Koloun Boutique et à la caisse)
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/promotionController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/', ctrl.lister);
router.get('/produits', ctrl.produits);
router.post('/', ctrl.creer);
router.put('/:id', ctrl.modifier);

module.exports = router;
