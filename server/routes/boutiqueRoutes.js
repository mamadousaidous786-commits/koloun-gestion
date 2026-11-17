const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boutiqueController');
const { verifierToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Limite simple contre les envois répétés de commandes (par adresse IP)
const envois = new Map();
function limiterCommandes(req, res, next) {
  const ip = req.ip || 'inconnu';
  const maintenant = Date.now();
  const recents = (envois.get(ip) || []).filter((t) => maintenant - t < 10 * 60 * 1000);
  if (recents.length >= 8) return res.status(429).json({ message: 'Trop de commandes envoyées. Réessayez dans quelques minutes ou écrivez-nous sur WhatsApp.' });
  recents.push(maintenant);
  envois.set(ip, recents);
  next();
}

// ---- Public : application Koloun Boutique ----
router.get('/infos', ctrl.infos);
router.get('/produits', ctrl.produits);
router.get('/nouveautes', ctrl.nouveautes);
router.get('/produits/:id', ctrl.produit);
router.get('/speciales', ctrl.speciales);
router.post('/commandes', limiterCommandes, ctrl.creerCommande);
router.get('/commandes/:code', ctrl.voirCommande);

// ---- Vendeur : tout utilisateur connecté à Koloun Gestion ----
router.get('/admin/commandes', verifierToken, ctrl.listerCommandes);
router.get('/admin/commandes/:id', verifierToken, ctrl.obtenirCommande);
router.patch('/admin/commandes/:id', verifierToken, ctrl.modifierCommande);
router.get('/admin/speciales', verifierToken, ctrl.listerSpecialesAdmin);
router.post('/admin/speciales', verifierToken, upload.array('images', 12), ctrl.creerSpeciale);
router.put('/admin/speciales/:id', verifierToken, upload.array('images', 12), ctrl.modifierSpeciale);
router.delete('/admin/speciales/:id', verifierToken, ctrl.retirerSpeciale);
router.get('/admin/produits', verifierToken, ctrl.listerProduitsAdmin);
router.patch('/admin/produits/:id', verifierToken, ctrl.reglerProduit);

module.exports = router;
