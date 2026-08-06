const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);
router.get('/', ctrl.listerNotifications);
router.put('/:id/lue', ctrl.marquerLue);
router.delete('/:id', ctrl.supprimerNotification);
router.delete('/', ctrl.supprimerToutesNotifications);

module.exports = router;
