const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sauvegardeController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/export', ctrl.exporter);

module.exports = router;
