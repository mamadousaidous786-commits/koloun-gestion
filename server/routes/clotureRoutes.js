const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clotureController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/apercu', ctrl.apercu);
router.get('/', ctrl.lister);
router.post('/', ctrl.enregistrer);

module.exports = router;
