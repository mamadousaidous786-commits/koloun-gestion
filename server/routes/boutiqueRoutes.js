const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boutiqueController');
const compte = require('../controllers/compteController');
const { verifierToken, autoriserRoles } = require('../middleware/auth');
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

// ---- Comptes clients (une seule porte : un compte Koloun Gestion ouvre l'espace vendeur) ----
router.post('/auth/inscription', compte.inscription);
router.post('/auth/connexion', compte.connexion);
router.post('/auth/google', compte.google);
router.get('/compte', compte.exigerCompte, compte.monCompte);
router.put('/compte', compte.exigerCompte, compte.modifierCompte);
router.post('/compte/commandes/:code/annuler', compte.exigerCompte, ctrl.annulerParClient);

// ---- Vendeur : tout utilisateur connecté à Koloun Gestion ----
router.get('/admin/commandes', verifierToken, ctrl.listerCommandes);
router.get('/admin/a-confirmer', verifierToken, ctrl.aConfirmer);
router.post('/admin/commandes/:id/accepter', verifierToken, ctrl.accepter);
router.post('/admin/commandes/:id/refuser', verifierToken, ctrl.refuser);
router.get('/admin/commandes/:id', verifierToken, ctrl.obtenirCommande);
router.patch('/admin/commandes/:id', verifierToken, ctrl.modifierCommande);
router.get('/admin/speciales', verifierToken, ctrl.listerSpecialesAdmin);
router.post('/admin/speciales', verifierToken, upload.array('images', 12), ctrl.creerSpeciale);
router.put('/admin/speciales/:id', verifierToken, upload.array('images', 12), ctrl.modifierSpeciale);
router.delete('/admin/speciales/:id', verifierToken, ctrl.retirerSpeciale);
router.get('/admin/produits', verifierToken, ctrl.listerProduitsAdmin);
router.patch('/admin/produits/:id', verifierToken, ctrl.reglerProduit);

// ---- Clients inscrits : réservé à l'administrateur ----
router.get('/admin/clients', verifierToken, autoriserRoles('admin'), compte.listerClients);
router.get('/admin/clients/:id/commandes', verifierToken, autoriserRoles('admin'), compte.commandesClient);
router.patch('/admin/clients/:id', verifierToken, autoriserRoles('admin'), compte.reglerClient);
router.post('/admin/clients/:id/reinitialiser', verifierToken, autoriserRoles('admin'), compte.reinitialiserMotDePasse);

module.exports = router;
