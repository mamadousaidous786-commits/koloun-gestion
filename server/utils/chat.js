// ============================================================
// DISCUSSION CLIENT ↔ VENDEUR (dans Koloun Boutique et Koloun Gestion)
// Une conversation par compte client. Messages : texte, photo, carte produit, carte panier,
// carte commande / réservation (affichée avec son état à jour), changement de prix.
// Le client est prévenu par notification quand la boutique répond, et inversement.
// ============================================================
const webpush = require('web-push');
const sequelize = require('../config/database');
const PushAbonnement = require('../models/PushAbonnement');
const { actif, envoyerAlerte } = require('./push');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = [], transaction) => sequelize.query(t, { ...SELECT, replacements: r, transaction });
const exec = (t, r = [], transaction) => sequelize.query(t, { replacements: r, transaction });
const gnf = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} GNF`;
const nombre = (n) => Math.round(Number(n) || 0);

// Statut d'une commande en ligne tel que le client le voit (la livraison fait foi quand elle existe)
const STATUT_COMMANDE = `CASE WHEN c.livraison_id IS NOT NULL AND lv.id IS NULL THEN 'annulee'
  WHEN lv.statut = 'livree' THEN 'livree' WHEN lv.statut = 'annulee' THEN 'annulee'
  WHEN lv.statut = 'en_cours' THEN 'validee' ELSE c.statut END`;

async function conversationDuCompte(compteId) {
  await exec('INSERT IGNORE INTO chat_conversations (boutique_id, compte_client_id) VALUES (?, ?)', [BOUTIQUE_ID, compteId]);
  const [c] = await sql('SELECT * FROM chat_conversations WHERE boutique_id = ? AND compte_client_id = ?', [BOUTIQUE_ID, compteId]);
  return c;
}

function apercu(type, texte, d = {}) {
  switch (type) {
    case 'image': return '📷 Photo';
    case 'produit': return `🛍️ ${d.nom || 'Article'}`;
    case 'panier': return `🛒 Panier : ${d.lignes?.length || 0} article(s)`;
    case 'commande': return `📦 Commande ${d.reference || ''}`.trim();
    case 'reservation': return `🔖 Réservation ${d.numero || ''}`.trim();
    case 'prix': return `💰 Nouveau prix : ${gnf(d.nouveau)}`;
    default: return String(texte || '').slice(0, 190);
  }
}

// Notification sur les téléphones du client (l'application Koloun Boutique)
async function prevenirClient(compteId, { titre, corps, url = '/messages', tag = 'chat' }) {
  if (!actif) return 0;
  const appareils = await PushAbonnement.findAll({ where: { boutique_id: BOUTIQUE_ID, role: 'client', utilisateur_id: compteId } });
  const charge = JSON.stringify({ titre, corps, url, tag });
  let n = 0;
  for (const a of appareils) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 24 * 3600, urgency: 'high' });
      n += 1;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await a.destroy().catch(() => {});
    }
  }
  return n;
}

// Ajoute un message et prévient l'autre côté
async function ajouter(conv, { auteur, utilisateur_id = null, type = 'texte', texte = null, donnees = null, silencieux = false }) {
  const [id] = await sequelize.query(
    'INSERT INTO chat_messages (conversation_id, auteur, utilisateur_id, type, texte, donnees) VALUES (?,?,?,?,?,?)',
    { type: sequelize.QueryTypes.INSERT, replacements: [conv.id, auteur, utilisateur_id, type, texte ? String(texte).slice(0, 4000) : null, donnees ? JSON.stringify(donnees) : null] });
  const resume = apercu(type, texte, donnees || {});
  const pourClient = auteur !== 'client';
  await exec(`UPDATE chat_conversations SET apercu = ?, dernier_message_at = NOW(), dernier_auteur = ?,
      non_lu_client = non_lu_client + ?, non_lu_vendeur = non_lu_vendeur + ? WHERE id = ?`,
  [resume, auteur, pourClient ? 1 : 0, pourClient ? 0 : 1, conv.id]);

  if (silencieux) return id; // déjà signalé autrement (ex. : la commande a sa propre alerte dans Gestion)
  if (pourClient) {
    prevenirClient(conv.compte_client_id, { titre: auteur === 'agent' ? 'Koloun Luxure' : 'Koloun Luxure vous a répondu', corps: resume }).catch(() => {});
  } else {
    const [c] = await sql('SELECT nom FROM comptes_clients WHERE id = ?', [conv.compte_client_id]);
    envoyerAlerte(conv.boutique_id, { titre: `💬 ${c?.nom || 'Client'}`, corps: resume, url: `/messages?c=${conv.id}`, tag: `chat-${conv.id}` }, ['admin', 'utilisateur']).catch(() => {});
  }
  return id;
}

// Les cartes commande / réservation sont affichées avec leur état actuel (prix, statut)
async function enrichir(messages, urlImage = (x) => x) {
  const commandes = [...new Set(messages.filter((m) => m.type === 'commande' || m.type === 'prix').map((m) => m.donnees?.commande_id).filter(Boolean))];
  const reservations = [...new Set(messages.filter((m) => m.type === 'reservation').map((m) => m.donnees?.reservation_id).filter(Boolean))];
  const parCommande = new Map(); const parResa = new Map();
  if (commandes.length) {
    const liste = await sql(`SELECT c.id, c.reference, c.code, ${STATUT_COMMANDE} AS statut, c.mode_livraison, c.total_initial, c.remise, c.total_final, c.frais_livraison
      FROM boutique_commandes c LEFT JOIN livraisons lv ON lv.id = c.livraison_id WHERE c.id IN (${commandes.map(Number).join(',')})`);
    const lignes = await sql(`SELECT id, commande_id, nom, image, taille, quantite, prix_unitaire, prix_negocie FROM boutique_commande_lignes WHERE commande_id IN (${commandes.map(Number).join(',')}) ORDER BY id`);
    for (const c of liste) {
      parCommande.set(c.id, {
        id: c.id, reference: c.reference, code: c.code, statut: c.statut, mode_livraison: c.mode_livraison,
        total_initial: nombre(c.total_initial), remise: nombre(c.remise), total_final: nombre(c.total_final), frais_livraison: nombre(c.frais_livraison),
        lignes: lignes.filter((l) => l.commande_id === c.id).map((l) => ({ id: l.id, nom: l.nom, image: urlImage(l.image), taille: l.taille, quantite: l.quantite,
          prix_unitaire: nombre(l.prix_unitaire), prix_negocie: l.prix_negocie == null ? null : nombre(l.prix_negocie) })),
      });
    }
  }
  if (reservations.length) {
    const liste = await sql(`SELECT id, numero, statut, total, date_expiration FROM reservations WHERE id IN (${reservations.map(Number).join(',')})`);
    const articles = await sql(`SELECT reservation_id, produit_nom, taille, quantite, prix, image FROM reservation_articles WHERE reservation_id IN (${reservations.map(Number).join(',')}) ORDER BY id`);
    for (const r of liste) {
      parResa.set(r.id, { id: r.id, numero: r.numero, statut: r.statut, total: nombre(r.total), date_expiration: r.date_expiration,
        articles: articles.filter((a) => a.reservation_id === r.id).map((a) => ({ nom: a.produit_nom, taille: a.taille, quantite: a.quantite, prix: nombre(a.prix), image: urlImage(a.image) })) });
    }
  }
  return messages.map((m) => {
    const d = m.donnees || {};
    if (m.type === 'commande' || m.type === 'prix') return { ...m, commande: parCommande.get(d.commande_id) || null };
    if (m.type === 'reservation') return { ...m, reservation: parResa.get(d.reservation_id) || null };
    if (m.type === 'image') return { ...m, donnees: { ...d, url: urlImage(d.url) } };
    if (m.type === 'produit') return { ...m, donnees: { ...d, image: urlImage(d.image) } };
    if (m.type === 'panier') return { ...m, donnees: { ...d, lignes: (d.lignes || []).map((l) => ({ ...l, image: urlImage(l.image) })) } };
    return m;
  });
}

async function lireMessages(convId, { apres = 0, limite = 80 } = {}) {
  const lignes = apres
    ? await sql('SELECT id, auteur, type, texte, donnees, created_at FROM chat_messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT 200', [convId, apres])
    : (await sql('SELECT id, auteur, type, texte, donnees, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?', [convId, limite])).reverse();
  return lignes.map((m) => { let donnees = null; try { donnees = m.donnees ? JSON.parse(m.donnees) : null; } catch { /* ignoré */ } return { ...m, donnees }; });
}

// Raccourcis utilisés par les commandes, réservations et changements de prix
async function publierPourCompte(compteId, message) {
  if (!compteId) return null;
  const conv = await conversationDuCompte(compteId);
  return ajouter(conv, message);
}
const messageCommande = (compteId, c) => publierPourCompte(compteId, { auteur: 'client', type: 'commande', donnees: { commande_id: c.id, reference: c.reference }, silencieux: true });
const messageReservation = (compteId, r) => publierPourCompte(compteId, { auteur: 'client', type: 'reservation', donnees: { reservation_id: r.id, numero: r.numero }, silencieux: true });
const messagePrix = (compteId, c, ancien, nouveau, utilisateurId) => publierPourCompte(compteId, { auteur: 'vendeur', utilisateur_id: utilisateurId, type: 'prix', donnees: { commande_id: c.id, reference: c.reference, ancien, nouveau } });
const messageSysteme = (compteId, texte) => publierPourCompte(compteId, { auteur: 'systeme', type: 'texte', texte });

module.exports = { conversationDuCompte, ajouter, enrichir, lireMessages, messageCommande, messageReservation, messagePrix, messageSysteme, prevenirClient, apercu, BOUTIQUE_ID };
