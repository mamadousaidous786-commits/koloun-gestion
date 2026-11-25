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
        if (r.compte_client_id) require('./chat').messageSysteme(r.compte_client_id, `⌛ Réservation ${r.numero} annulée : le délai de ${JOURS} jours est dépassé. Les articles sont remis en vente.`).catch(() => {});
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

// L'agent IA prend le relais quand un client attend depuis 5 minutes sans réponse de la boutique
// (seulement si la clé Anthropic est installée ; il ne répond qu'une fois par message du client)
let relaisEnCours = false;
async function relaisAgent() {
  if (relaisEnCours) return;
  const agent = require('./agentKoloun');
  if (!agent.actif()) return;
  relaisEnCours = true;
  try {
    const chat = require('./chat');
    const attente = await sql(`SELECT c.*, k.nom, k.telephone FROM chat_conversations c JOIN comptes_clients k ON k.id = c.compte_client_id
      WHERE c.dernier_auteur = 'client' AND c.dernier_message_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        AND c.dernier_message_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 10`);
    for (const conv of attente) {
      // Messages du client depuis la dernière réponse (boutique ou agent)
      const [derniere] = await sql("SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE conversation_id = ? AND auteur IN ('vendeur','agent')", [conv.id]);
      const nouveaux = await sql("SELECT type, texte, donnees FROM chat_messages WHERE conversation_id = ? AND auteur = 'client' AND id > ? ORDER BY id", [conv.id, derniere.id]);
      const texte = nouveaux.map((m) => {
        let d = {}; try { d = JSON.parse(m.donnees || '{}'); } catch { /* ignoré */ }
        if (m.type === 'produit') return `[Le client montre l'article « ${d.nom} »${d.taille ? ` taille ${d.taille}` : ''}, ${d.prix} GNF, id ${d.produit_id}]`;
        if (m.type === 'panier') return `[Panier du client : ${(d.lignes || []).map((l) => `${l.nom} T.${l.taille} ×${l.quantite}`).join(', ')}]`;
        if (m.type === 'image') return `[Le client envoie une photo]${m.texte ? ` ${m.texte}` : ''}`;
        if (m.type === 'commande') return `[Le client vient de passer la commande ${d.reference}]`;
        if (m.type === 'reservation') return `[Le client vient de réserver ${d.numero}]`;
        return m.texte;
      }).filter(Boolean).join('\n');
      if (!texte) { await exec("UPDATE chat_conversations SET dernier_auteur = 'attente' WHERE id = ?", [conv.id]); continue; }
      // Marqué tout de suite pour ne pas répondre deux fois
      await exec("UPDATE chat_conversations SET dernier_auteur = 'attente' WHERE id = ? AND dernier_auteur = 'client'", [conv.id]);
      const r = await agent.repondre({ canal: 'appli', identifiant: `compte-${conv.compte_client_id}`, texte, nom: conv.nom, telephone: conv.telephone });
      for (const t of r.textes || []) await chat.ajouter(conv, { auteur: 'agent', type: 'texte', texte: t });
      for (const im of r.images || []) await chat.ajouter(conv, { auteur: 'agent', type: 'image', texte: im.legende || null, donnees: { url: im.url } });
    }
  } catch (e) {
    console.error('Relais agent :', e.message);
  } finally { relaisEnCours = false; }
}

function planifierTaches() {
  setInterval(() => relaisAgent(), 60 * 1000);
  // Photos envoyées dans les discussions : effacées de Cloudinary / du serveur au bout de 24 h
  const nettoyerPhotos = () => require('./chat').supprimerPhotosExpirees().catch((e) => console.error('Photos de discussion :', e.message));
  setTimeout(nettoyerPhotos, 60 * 1000);
  setInterval(nettoyerPhotos, 30 * 60 * 1000);
  const lancer = () => verifierReservations({ forcer: true }).catch((e) => console.error('Tâches boutique :', e.message));
  setTimeout(lancer, 20 * 1000);
  setInterval(lancer, 10 * 60 * 1000);
}

module.exports = { verifierReservations, prevenirTaillesRevenues, planifierTaches, relaisAgent };

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
