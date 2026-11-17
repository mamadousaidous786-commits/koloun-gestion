const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/livraisonController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifierToken); // visible et utilisable par tous les utilisateurs
router.get('/', ctrl.lister);
router.post('/', upload.single('image'), ctrl.creer);
router.put('/:id', upload.single('image'), ctrl.modifier);
router.put('/:id/statut', ctrl.changerStatut);
router.delete('/:id', autoriserRoles('admin'), ctrl.supprimer);

module.exports = router;
