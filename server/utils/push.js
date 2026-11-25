const webpush = require('web-push');
const crypto = require('crypto');
const PushAbonnement = require('../models/PushAbonnement');

// Clés VAPID : à définir dans les variables d'environnement du serveur (Render).
// Sans elles, les alertes sont simplement désactivées (le reste de l'application fonctionne).
const actif = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (actif) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@koloun.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

const hash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

const TITRES = {
  rupture_stock: '🚫 Rupture de stock',
  stock_faible: '⚠️ Stock faible',
  commande_speciale_arrivee: '📦 Commande spéciale arrivée',
  livraison_nouvelle: '🚚 Nouvelle livraison',
  livraison_livree: '✅ Livraison effectuée',
  livraison_annulee: '❌ Livraison annulée',
  reservation_en_ligne: '🔖 Nouvelle réservation en ligne',
  reservation_relance: '⏰ Réservation à relancer',
  reservation_expiree: '⌛ Réservation expirée',
  commande_agent: '🤖 Commande transmise par l\'agent',
};

// Envoie une alerte aux appareils de la boutique (par défaut : aux administrateurs)
async function envoyerAlerte(boutique_id, { titre, corps, url = '/notifications', tag, urgent = false }, roles = ['admin'], exclureUtilisateur = null) {
  if (!actif) return;
  try {
    let abonnes = await PushAbonnement.findAll({ where: { boutique_id, role: roles } });
    if (exclureUtilisateur) abonnes = abonnes.filter((a) => a.utilisateur_id !== exclureUtilisateur); // pas d'alerte pour celui qui vient d'agir
    const charge = JSON.stringify({ titre, corps, url, tag, urgent });
    await Promise.all(abonnes.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 60 * 60 * 24, urgency: urgent ? 'high' : 'normal' });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await a.destroy().catch(() => {}); // appareil désinscrit
      }
    }));
  } catch (e) {
    console.error('Alerte push :', e.message);
  }
}

// Toute notification créée dans l'application (rupture, stock faible, commande spéciale arrivée…)
// déclenche automatiquement une alerte sur les téléphones abonnés, même application fermée.
function brancherNotifications(Notification) {
  const envoyer = (n) => {
    const livraison = n.type.startsWith('livraison_');
    return envoyerAlerte(n.boutique_id, {
      titre: TITRES[n.type] || 'Koloun Luxure',
      corps: n.message,
      url: livraison ? '/livraisons' : n.type.startsWith('reservation_') ? '/reservations' : '/notifications',
      tag: `${n.type}-${n.id || Date.now()}`,
      urgent: n.type === 'rupture_stock',
    }, livraison ? ['admin', 'utilisateur'] : ['admin'], livraison ? n.utilisateur_id : null);
  };
  const apresValidation = (options, fn) => (options && options.transaction ? options.transaction.afterCommit(fn) : fn());

  Notification.addHook('afterCreate', (n, options) => apresValidation(options, () => envoyer(n)));
  Notification.addHook('afterBulkCreate', (liste, options) => apresValidation(options, () => liste.forEach(envoyer)));
}

module.exports = { actif, envoyerAlerte, brancherNotifications, hash };
