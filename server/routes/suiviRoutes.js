const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/suiviController');

router.get('/:code', ctrl.consulter); // sans connexion

module.exports = router;
