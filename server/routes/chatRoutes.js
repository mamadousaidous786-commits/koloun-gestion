// Discussion avec les clients de Koloun Boutique (page « Messages » de Koloun Gestion)
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chatController');
const upload = require('../middleware/upload');
const { verifierToken } = require('../middleware/auth');

router.use(ctrl.jetonDansAdresse); // pour le direct (EventSource)
router.use(verifierToken);
router.get('/flux', ctrl.flux);
router.get('/', ctrl.conversations);
router.get('/non-lus', ctrl.nonLus);
router.get('/:id', ctrl.lire);
router.post('/:id', upload.single('image'), ctrl.envoyer);

module.exports = router;
