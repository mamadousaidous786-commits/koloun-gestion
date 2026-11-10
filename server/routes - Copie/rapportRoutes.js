const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rapportController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));
router.get('/mensuel', ctrl.mensuel);

module.exports = router;
