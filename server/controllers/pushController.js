const PushAbonnement = require('../models/PushAbonnement');
const { actif, envoyerAlerte, hash } = require('../utils/push');

// GET /api/push/cle -- clé publique pour que le navigateur puisse s'abonner
exports.cle = (req, res) => {
  if (!actif) return res.status(503).json({ message: "Les alertes ne sont pas encore configurées sur le serveur (clés VAPID manquantes)." });
  res.json({ cle: process.env.VAPID_PUBLIC_KEY });
};

// POST /api/push/abonner  { endpoint, keys: { p256dh, auth } }
exports.abonner = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ message: 'Abonnement invalide.' });
    const donnees = {
      boutique_id: req.utilisateur.boutique_id,
      utilisateur_id: req.utilisateur.id,
      role: req.utilisateur.role,
      endpoint_hash: hash(endpoint),
      endpoint, p256dh: keys.p256dh, auth: keys.auth,
    };
    const existant = await PushAbonnement.findOne({ where: { endpoint_hash: donnees.endpoint_hash } });
    if (existant) await existant.update(donnees); else await PushAbonnement.create(donnees);
    res.json({ message: 'Alertes activées sur cet appareil.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/push/desabonner  { endpoint }
exports.desabonner = async (req, res) => {
  try {
    if (req.body?.endpoint) await PushAbonnement.destroy({ where: { endpoint_hash: hash(req.body.endpoint) } });
    res.json({ message: 'Alertes désactivées sur cet appareil.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/push/test -- envoie une alerte d'essai à tous les appareils de la boutique
exports.test = async (req, res) => {
  await envoyerAlerte(req.utilisateur.boutique_id, {
    titre: '🔔 Alertes Koloun Luxure', corps: 'Tout fonctionne : vous serez prévenu en cas de rupture de stock.', tag: 'test',
  }, ['admin', 'utilisateur']);
  res.json({ message: 'Alerte envoyée.' });
};
