const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pushController');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);
router.get('/cle', ctrl.cle);
router.post('/abonner', ctrl.abonner);
router.post('/desabonner', ctrl.desabonner);
router.post('/test', ctrl.test);

module.exports = router;
