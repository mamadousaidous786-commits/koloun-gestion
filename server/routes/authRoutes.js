const express = require('express');
const router = express.Router();
const { login, register, profil } = require('../controllers/authController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', verifierToken, autoriserRoles('admin'), register);
router.get('/me', verifierToken, profil);

module.exports = router;
