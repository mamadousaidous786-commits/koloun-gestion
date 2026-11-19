// Koloun Boutique : un client accepte (ou refuse) d'être prévenu des nouveaux arrivages
const PushAbonnement = require('../models/PushAbonnement');
const { actif, hash } = require('../utils/push');
const { compterAbonnes, BOUTIQUE_ID, ROLE_CLIENT } = require('../utils/annonces');
const { lireCompte } = require('./compteController');

// GET /api/boutique/notifications/cle
exports.cle = (req, res) => {
  if (!actif) return res.status(503).json({ message: 'Les notifications ne sont pas encore disponibles.' });
  res.json({ cle: process.env.VAPID_PUBLIC_KEY });
};

// POST /api/boutique/notifications/abonner  { endpoint, keys: { p256dh, auth } }  (compte client facultatif)
exports.abonner = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !/^https:\/\//.test(endpoint) || endpoint.length > 2000 || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Abonnement invalide.' });
    }
    const compte = await Promise.resolve(lireCompte(req)).catch(() => null);
    const donnees = {
      boutique_id: BOUTIQUE_ID,
      utilisateur_id: compte?.id || null, // compte client (si connecté), jamais un utilisateur de Gestion
      role: ROLE_CLIENT,
      endpoint_hash: hash(endpoint),
      endpoint,
      p256dh: String(keys.p256dh).slice(0, 255),
      auth: String(keys.auth).slice(0, 255),
    };
    const existant = await PushAbonnement.findOne({ where: { endpoint_hash: donnees.endpoint_hash } });
    // Un appareil déjà abonné aux alertes de Gestion n'est pas transformé en abonnement client
    if (existant && existant.role !== ROLE_CLIENT) return res.json({ message: 'Notifications déjà actives sur cet appareil.' });
    if (existant) await existant.update(donnees); else await PushAbonnement.create(donnees);
    res.json({ message: 'Vous serez prévenu des nouveaux arrivages.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/boutique/notifications/desabonner  { endpoint }
exports.desabonner = async (req, res) => {
  try {
    if (req.body?.endpoint) await PushAbonnement.destroy({ where: { endpoint_hash: hash(req.body.endpoint), role: ROLE_CLIENT } });
    res.json({ message: 'Notifications désactivées.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/boutique/admin/notifications  (Gestion) : nombre de clients prévenus
exports.nombreAbonnes = async (req, res) => {
  try {
    res.json({ actif, abonnes: actif ? await compterAbonnes() : 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
