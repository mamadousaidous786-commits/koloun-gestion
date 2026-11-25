// ============================================================
// TÂCHES AUTOMATIQUES (toutes les 10 minutes, et à l'ouverture de la page Réservations)
// 1. Réservations mises de côté : rappel la veille de la date limite, puis annulation automatique
//    (le stock est remis en vente) si le client n'est pas passé.
//    Réservations en ligne jamais confirmées : annulées au bout du même délai.
// 2. « Prévenez-moi quand ma taille revient » : dès qu'une taille attendue est de nouveau en stock,
//    les clients qui l'attendent reçoivent une notification sur leur téléphone.
// Sur Render gratuit, le serveur s'endort : la vérification se fait aussi à chaque visite de Gestion.
// ============================================================
const webpush = require('web-push');
const sequelize = require('../config/database');
const { Notification } = require('../models');
const PushAbonnement = require('../models/PushAbonnement');
const { actif } = require('./push');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const JOURS = Math.max(1, Number(process.env.RESERVATION_JOURS) || 7);
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = [], transaction) => sequelize.query(t, { ...SELECT, replacements: r, transaction });
const exec = (t, r = [], transaction) => sequelize.query(t, { replacements: r, transaction });
const gnf = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} GNF`;

let derniereVerification = 0;
let enCours = null;

async function verifierReservations({ forcer = false } = {}) {
  if (!forcer && Date.now() - derniereVerification < 30 * 1000) return enCours || undefined; // pas plus d'une fois toutes les 30 s
  derniereVerification = Date.now();
  enCours = (async () => {
    // Rappel la veille : « Relancer Aminata »
    const aRelancer = await sql(`SELECT id, boutique_id, numero, client_nom, total FROM reservations
      WHERE statut = 'en_attente' AND rappel_envoye = 0 AND date_expiration IS NOT NULL
        AND date_expiration <= DATE_ADD(NOW(), INTERVAL 1 DAY) AND date_expiration > NOW()`);
    for (const r of aRelancer) {
      await exec('UPDATE reservations SET rappel_envoye = 1 WHERE id = ?', [r.id]);
      await Notification.create({ boutique_id: r.boutique_id, type: 'reservation_relance',
        message: `Relancer ${String(r.client_nom).slice(0, 40)} : la réservation ${r.numero} (${gnf(r.total)}) sera annulée demain s'il ne passe pas.`.slice(0, 255) });
    }

    // Délai dépassé : annulation, stock remis en vente
    const expirees = await sql(`SELECT id FROM reservations WHERE statut = 'en_attente' AND date_expiration IS NOT NULL AND date_expiration <= NOW()`);
    for (const { id } of expirees) {
      const t = await sequelize.transaction();
      try {
        const [r] = await sql('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id], t);
        if (!r || r.statut !== 'en_attente') { await t.commit(); continue; }
        if (Number(r.stock_bloque ?? 1) === 1) {
          const articles = await sql('SELECT produit_taille_id, quantite FROM reservation_articles WHERE reservation_id = ?', [r.id], t);
          for (const a of articles) if (a.produit_taille_id) await exec('UPDATE produit_tailles SET quantite = quantite + ? WHERE id = ?', [a.quantite, a.produit_taille_id], t);
        }
        await exec("UPDATE reservations SET statut = 'annulee', motif = ?, date_traitement = NOW() WHERE id = ?", [`Délai dépassé (${JOURS} jours)`, r.id], t);
        await Notification.create({ boutique_id: r.boutique_id, type: 'reservation_expiree',
          message: `Réservation ${r.numero} de ${String(r.client_nom).slice(0, 40)} annulée : délai de ${JOURS} jours dépassé. Les articles sont remis en vente.`.slice(0, 255) }, { transaction: t });
        await t.commit();
      } catch (e) {
        await t.rollback().catch(() => {});
        console.error('Réservation expirée :', e.message);
      }
    }

    // Réservations en ligne jamais confirmées (le stock n'a pas été touché)
    await exec(`UPDATE reservations SET statut = 'annulee', motif = 'Non confirmée par la boutique', date_traitement = NOW()
      WHERE statut = 'a_confirmer' AND created_at <= DATE_SUB(NOW(), INTERVAL ${JOURS} DAY)`);

    await prevenirTaillesRevenues();
  })().finally(() => { enCours = null; });
  return enCours;
}

// Tailles attendues de nouveau en stock → notification aux clients qui les attendent
async function prevenirTaillesRevenues() {
  const revenues = await sql(`SELECT a.id, a.compte_client_id, t.taille, p.id AS produit_id, p.nom, p.prix_normal, v.image
    FROM alertes_tailles a
    JOIN produit_tailles t ON t.id = a.produit_taille_id
    JOIN produit_variantes v ON v.id = t.produit_variante_id
    JOIN produits p ON p.id = v.produit_id
    WHERE a.statut = 'attente' AND t.quantite > 0 LIMIT 500`);
  if (!revenues.length) return 0;
  await exec(`UPDATE alertes_tailles SET statut = 'prevenu', date_prevenu = NOW() WHERE id IN (${revenues.map((r) => Number(r.id)).join(',')})`);
  if (!actif) return 0; // le client le verra quand même dans son compte (« De retour »)
  let envoyes = 0;
  for (const r of revenues) {
    const appareils = await PushAbonnement.findAll({ where: { boutique_id: BOUTIQUE_ID, role: 'client', utilisateur_id: r.compte_client_id } });
    const image = r.image && /^https?:\/\//.test(r.image) ? (r.image.includes('/res.cloudinary.com/') ? r.image.replace('/upload/', '/upload/w_720,c_limit,q_auto,f_jpg/') : r.image) : undefined;
    const charge = JSON.stringify({
      titre: `Votre taille est de retour : ${r.nom}`,
      corps: `Taille ${r.taille} · ${gnf(r.prix_normal)}\nDe nouveau disponible chez Koloun Luxure. Réservez-la vite !`,
      image, url: `/article/${r.produit_id}`, tag: `retour-${r.id}`,
    });
    for (const a of appareils) {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 3 * 24 * 3600, urgency: 'high' });
        envoyes += 1;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await a.destroy().catch(() => {});
      }
    }
  }
  return envoyes;
}

function planifierTaches() {
  const lancer = () => verifierReservations({ forcer: true }).catch((e) => console.error('Tâches boutique :', e.message));
  setTimeout(lancer, 20 * 1000);
  setInterval(lancer, 10 * 60 * 1000);
}

module.exports = { verifierReservations, prevenirTaillesRevenues, planifierTaches };

// Après chaque modification réussie dans Gestion (produit, stock, vente annulée, réservation annulée…),
// on regarde dans les 5 secondes si une taille attendue est revenue : le client est prévenu presque tout de suite.
let minuteur = null;
function surveillerStock(req, res, next) {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => prevenirTaillesRevenues().catch((e) => console.error('Alertes tailles :', e.message)), 5000);
    });
  }
  next();
}
module.exports.surveillerStock = surveillerStock;
