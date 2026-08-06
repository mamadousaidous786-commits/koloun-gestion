const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/recuController');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);
router.get('/:vente_id/pdf', ctrl.genererRecu);
router.get('/:vente_id/telecharger', ctrl.telechargerRecu);

module.exports = router;
