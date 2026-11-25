// ============================================================
// RÉSERVATIONS — articles du stock mis de côté pour un client.
// À la réservation : le stock est bloqué (retiré de la vente), le prix accordé est noté.
// Au retrait : la vente est enregistrée en caisse avec son reçu (le stock a déjà été retiré).
// Annulation : le stock est remis en vente.
// Réservations faites par les clients dans Koloun Boutique : elles arrivent « À confirmer » sans toucher au stock ;
// quand le vendeur confirme, le stock est bloqué (stock_bloque = 1).
// ============================================================
const { Op } = require('sequelize');
const { sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, Recu, Notification } = require('../models');
const { trouverOuCreerClient } = require('../utils/clients');
const { numeroRecu, moyenValide } = require('../utils/venteEnLigne');

const SELECT = { type: sequelize.QueryTypes.SELECT };
const erreur = (code, message) => Object.assign(new Error(message), { code });
const repondreErreur = (res, e) => (e.code && e.code < 500
  ? res.status(e.code).json({ message: e.message })
  : res.status(500).json({ message: 'Erreur serveur.', erreur: e.message }));

async function numeroReservation(boutique_id, transaction) {
  const d = new Date();
  const prefixe = `RES-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const [r] = await sequelize.query('SELECT COUNT(*) AS n FROM reservations WHERE boutique_id = ? AND numero LIKE ?', { ...SELECT, replacements: [boutique_id, `${prefixe}%`], transaction });
  return `${prefixe}-${String(Number(r.n) + 1).padStart(3, '0')}`;
}

// Retire du stock les quantités réservées (contrôle + alertes stock), dans la transaction donnée
async function bloquerStock(boutique_id, totalParTaille, t) {
  const tailles = await ProduitTaille.findAll({
    where: { id: [...totalParTaille.keys()] },
    include: [{ model: ProduitVariante, attributes: ['id'], include: [{ model: Produit, attributes: ['id', 'nom', 'boutique_id'] }] }],
    transaction: t, lock: t.LOCK.UPDATE,
  });
  const parId = new Map(tailles.filter((x) => x.ProduitVariante?.Produit?.boutique_id === boutique_id).map((x) => [x.id, x]));
  for (const [id, qte] of totalParTaille) {
    const x = parId.get(id);
    if (!x) throw erreur(409, "Un des articles réservés n'existe plus dans les produits.");
    if (x.quantite < qte) throw erreur(409, `Stock insuffisant pour « ${x.ProduitVariante.Produit.nom} » (taille ${x.taille}) : ${x.quantite} disponible${x.quantite > 1 ? 's' : ''}, ${qte} réservé${qte > 1 ? 's' : ''}.`);
  }
  const notifications = [];
  for (const [id, qte] of totalParTaille) {
    const x = parId.get(id);
    await x.decrement('quantite', { by: qte, transaction: t });
    const reste = x.quantite - qte; const nom = x.ProduitVariante.Produit.nom;
    if (reste === 0) notifications.push({ boutique_id, type: 'rupture_stock', message: `Le produit "${nom}" (taille ${x.taille}) est en rupture de stock (réservé).` });
    else if (reste <= x.seuil_alerte) notifications.push({ boutique_id, type: 'stock_faible', message: `Le stock du produit "${nom}" (taille ${x.taille}) est faible (${reste} restant(s)).` });
  }
  if (notifications.length) await Notification.bulkCreate(notifications, { transaction: t });
}

// Réservations avec leurs articles, le nom de qui les a faites et le reçu de vente
async function charger(boutique_id, { id, statut, recherche } = {}) {
  const conditions = ['r.boutique_id = ?'];
  const valeurs = [boutique_id];
  if (id) { conditions.push('r.id = ?'); valeurs.push(id); }
  if (statut && statut !== 'toutes') { conditions.push('r.statut = ?'); valeurs.push(statut); }
  if (recherche) {
    conditions.push('(r.client_nom LIKE ? OR r.client_telephone LIKE ? OR r.numero LIKE ? OR EXISTS (SELECT 1 FROM reservation_articles a WHERE a.reservation_id = r.id AND a.produit_nom LIKE ?))');
    const m = `%${recherche}%`; valeurs.push(m, m, m, m);
  }
  const liste = await sequelize.query(
    `SELECT r.*, v.numero_recu, CONCAT_WS(' ', u.nom, u.prenom) AS cree_par_nom, CONCAT_WS(' ', t.nom, t.prenom) AS traite_par_nom
     FROM reservations r
     LEFT JOIN ventes v ON v.id = r.vente_id
     LEFT JOIN utilisateurs u ON u.id = r.cree_par
     LEFT JOIN utilisateurs t ON t.id = r.traite_par
     WHERE ${conditions.join(' AND ')}
     ORDER BY FIELD(r.statut, 'a_confirmer', 'en_attente', 'retiree', 'annulee'), r.created_at DESC LIMIT 300`, { ...SELECT, replacements: valeurs });
  if (!liste.length) return [];
  const articles = await sequelize.query(
    `SELECT * FROM reservation_articles WHERE reservation_id IN (${liste.map((r) => Number(r.id)).join(',')}) ORDER BY id`, SELECT);
  return liste.map((r) => ({
    ...r,
    total: Number(r.total),
    articles: articles.filter((a) => a.reservation_id === r.id).map((a) => ({ ...a, prix: Number(a.prix), prix_normal: Number(a.prix_normal) })),
  }));
}

// GET /api/reservations?statut=en_attente|retiree|annulee|toutes&q=
exports.lister = async (req, res) => {
  try {
    res.json(await charger(req.utilisateur.boutique_id, { statut: req.query.statut || 'toutes', recherche: (req.query.q || '').trim() }));
  } catch (e) { repondreErreur(res, e); }
};

// POST /api/reservations { client_id | client_nom + client_telephone, date_retrait_prevue, note, articles: [{ produit_taille_id, quantite, prix }] }
exports.creer = async (req, res) => {
  let t;
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { client_id, client_nom, client_telephone, date_retrait_prevue, note } = req.body;
    const demandes = (Array.isArray(req.body.articles) ? req.body.articles : [])
      .map((a) => ({ produit_taille_id: Number(a.produit_taille_id), quantite: Math.max(1, Math.floor(Number(a.quantite) || 1)), prix: a.prix }))
      .filter((a) => a.produit_taille_id);
    if (!demandes.length) throw erreur(400, 'Choisissez au moins un article à réserver.');
    if (!client_id && !(client_nom || '').trim()) throw erreur(400, 'Indiquez le nom du client.');

    const client = await trouverOuCreerClient(boutique_id, { client_id, nom: client_nom, telephone: client_telephone });
    t = await sequelize.transaction();

    const ids = [...new Set(demandes.map((a) => a.produit_taille_id))];
    const tailles = await ProduitTaille.findAll({
      where: { id: ids },
      include: [{ model: ProduitVariante, attributes: ['id', 'image'], include: [{ model: Produit, attributes: ['id', 'nom', 'prix_normal', 'boutique_id'] }] }],
      transaction: t, lock: t.LOCK.UPDATE,
    });
    const parId = new Map(tailles.filter((x) => x.ProduitVariante?.Produit?.boutique_id === boutique_id).map((x) => [x.id, x]));
    const totalParTaille = new Map();
    for (const a of demandes) {
      if (!parId.has(a.produit_taille_id)) throw erreur(404, "Un des articles choisis n'existe plus. Rechargez la page.");
      totalParTaille.set(a.produit_taille_id, (totalParTaille.get(a.produit_taille_id) || 0) + a.quantite);
    }
    for (const [id, qte] of totalParTaille) {
      const x = parId.get(id);
      if (x.quantite < qte) throw erreur(409, `Stock insuffisant pour « ${x.ProduitVariante.Produit.nom} » (taille ${x.taille}) : ${x.quantite} disponible${x.quantite > 1 ? 's' : ''}.`);
    }

    const lignes = demandes.map((a) => {
      const x = parId.get(a.produit_taille_id);
      const normal = Number(x.ProduitVariante.Produit.prix_normal);
      const prix = a.prix === undefined || a.prix === '' || a.prix === null ? normal : Math.max(0, Math.round(Number(a.prix)));
      return { ...a, prix, prix_normal: normal, nom: x.ProduitVariante.Produit.nom, taille: x.taille, image: x.ProduitVariante.image };
    });
    const total = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
    const nomClient = (client?.nom || client_nom || '').trim().slice(0, 150);

    const [resaId] = await sequelize.query(
      `INSERT INTO reservations (boutique_id, numero, client_id, client_nom, client_telephone, date_retrait_prevue, note, total, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [boutique_id, await numeroReservation(boutique_id, t), client?.id || null, nomClient,
        (client?.telephone || client_telephone || '').trim() || null, date_retrait_prevue || null, (note || '').trim().slice(0, 255) || null,
        total, req.utilisateur.id], type: sequelize.QueryTypes.INSERT, transaction: t });
    for (const l of lignes) {
      await sequelize.query(
        'INSERT INTO reservation_articles (reservation_id, produit_taille_id, produit_nom, taille, image, prix_normal, prix, quantite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        { replacements: [resaId, l.produit_taille_id, l.nom, l.taille, l.image, l.prix_normal, l.prix, l.quantite], type: sequelize.QueryTypes.INSERT, transaction: t });
    }

    // Le stock est bloqué tout de suite : ces articles ne peuvent plus être vendus à quelqu'un d'autre
    const notifications = [];
    for (const [id, qte] of totalParTaille) {
      const x = parId.get(id);
      await x.decrement('quantite', { by: qte, transaction: t });
      const reste = x.quantite - qte;
      const nom = x.ProduitVariante.Produit.nom;
      if (reste === 0) notifications.push({ boutique_id, type: 'rupture_stock', message: `Le produit "${nom}" (taille ${x.taille}) est en rupture de stock (réservé).` });
      else if (reste <= x.seuil_alerte) notifications.push({ boutique_id, type: 'stock_faible', message: `Le stock du produit "${nom}" (taille ${x.taille}) est faible (${reste} restant(s)).` });
    }
    if (notifications.length) await Notification.bulkCreate(notifications, { transaction: t });
    await t.commit();

    const [resa] = await charger(boutique_id, { id: resaId });
    res.status(201).json(resa);
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondreErreur(res, e);
  }
};

// PUT /api/reservations/:id/retrait { moyen_paiement_id, prix: { [article_id]: prix } }
// Le client est passé chercher sa commande : vente enregistrée en caisse avec son reçu.
exports.retirer = async (req, res) => {
  let t;
  try {
    const boutique_id = req.utilisateur.boutique_id;
    t = await sequelize.transaction();
    const [resa] = await sequelize.query('SELECT * FROM reservations WHERE id = ? AND boutique_id = ? FOR UPDATE', { ...SELECT, replacements: [req.params.id, boutique_id], transaction: t });
    if (!resa) throw erreur(404, 'Réservation introuvable.');
    if (resa.statut === 'a_confirmer') throw erreur(400, "Confirmez d'abord la réservation (le stock sera mis de côté).");
    if (resa.statut !== 'en_attente') throw erreur(400, resa.statut === 'retiree' ? 'Cette réservation a déjà été retirée.' : 'Cette réservation est annulée.');
    const articles = await sequelize.query('SELECT * FROM reservation_articles WHERE reservation_id = ? ORDER BY id', { ...SELECT, replacements: [resa.id], transaction: t });

    // Prix final : celui de la réservation, ou corrigé au moment du retrait
    const nouveaux = req.body.prix || {};
    const lignes = articles.map((a) => {
      const p = nouveaux[a.id];
      return { ...a, prix: p === undefined || p === '' || p === null ? Number(a.prix) : Math.max(0, Math.round(Number(p))) };
    });
    const total = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);

    const vente = await Vente.create({
      boutique_id,
      utilisateur_id: req.utilisateur.id,
      moyen_paiement_id: await moyenValide(req.body.moyen_paiement_id, t),
      client_id: resa.client_id,
      numero_recu: await numeroRecu(t),
      montant_total: total,
      observation: `Réservation ${resa.numero}${resa.note ? ` · ${resa.note}` : ''}`.slice(0, 255),
    }, { transaction: t });
    await DetailVente.bulkCreate(lignes.map((l) => ({
      vente_id: vente.id,
      produit_taille_id: l.produit_taille_id,
      produit_nom: l.produit_nom,
      taille_nom: l.taille,
      prix_normal: l.prix_normal,
      quantite: l.quantite,
      prix_applique: l.prix,
      sous_total: l.prix * l.quantite,
    })), { transaction: t });
    await Recu.create({ vente_id: vente.id }, { transaction: t });
    for (const l of lignes) {
      if (l.prix !== Number(articles.find((a) => a.id === l.id).prix)) {
        await sequelize.query('UPDATE reservation_articles SET prix = ? WHERE id = ?', { replacements: [l.prix, l.id], transaction: t });
      }
    }
    await sequelize.query(
      "UPDATE reservations SET statut = 'retiree', total = ?, vente_id = ?, traite_par = ?, date_traitement = NOW() WHERE id = ?",
      { replacements: [total, vente.id, req.utilisateur.id, resa.id], transaction: t });
    await t.commit();

    const [maj] = await charger(boutique_id, { id: resa.id });
    res.json(maj);
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondreErreur(res, e);
  }
};

// PUT /api/reservations/:id/annuler { motif } — le stock est remis en vente
// PUT /api/reservations/:id/confirmer — réservation faite en ligne : le vendeur confirme, le stock est mis de côté
exports.confirmer = async (req, res) => {
  let t;
  try {
    const boutique_id = req.utilisateur.boutique_id;
    t = await sequelize.transaction();
    const [resa] = await sequelize.query('SELECT * FROM reservations WHERE id = ? AND boutique_id = ? FOR UPDATE', { ...SELECT, replacements: [req.params.id, boutique_id], transaction: t });
    if (!resa) throw erreur(404, 'Réservation introuvable.');
    if (resa.statut !== 'a_confirmer') throw erreur(400, 'Cette réservation est déjà confirmée ou traitée.');
    const articles = await sequelize.query('SELECT * FROM reservation_articles WHERE reservation_id = ?', { ...SELECT, replacements: [resa.id], transaction: t });
    const total = new Map();
    for (const a of articles) if (a.produit_taille_id) total.set(a.produit_taille_id, (total.get(a.produit_taille_id) || 0) + a.quantite);
    await bloquerStock(boutique_id, total, t);
    await sequelize.query("UPDATE reservations SET statut = 'en_attente', stock_bloque = 1, confirme_par = ?, date_confirmation = NOW() WHERE id = ?",
      { replacements: [req.utilisateur.id, resa.id], transaction: t });
    await t.commit();
    const [maj] = await charger(boutique_id, { id: resa.id });
    res.json(maj);
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondreErreur(res, e);
  }
};

exports.annuler = async (req, res) => {
  let t;
  try {
    const boutique_id = req.utilisateur.boutique_id;
    t = await sequelize.transaction();
    const [resa] = await sequelize.query('SELECT * FROM reservations WHERE id = ? AND boutique_id = ? FOR UPDATE', { ...SELECT, replacements: [req.params.id, boutique_id], transaction: t });
    if (!resa) throw erreur(404, 'Réservation introuvable.');
    if (!['en_attente', 'a_confirmer'].includes(resa.statut)) throw erreur(400, 'Seule une réservation en attente peut être annulée.');
    const articles = await sequelize.query('SELECT * FROM reservation_articles WHERE reservation_id = ?', { ...SELECT, replacements: [resa.id], transaction: t });
    for (const a of articles) {
      // Le stock n'est remis que s'il avait été retiré (pas pour une réservation en ligne non confirmée)
      if (a.produit_taille_id && Number(resa.stock_bloque ?? 1) === 1) await ProduitTaille.increment('quantite', { by: a.quantite, where: { id: a.produit_taille_id }, transaction: t });
    }
    await sequelize.query(
      "UPDATE reservations SET statut = 'annulee', motif = ?, traite_par = ?, date_traitement = NOW() WHERE id = ?",
      { replacements: [(req.body.motif || '').trim().slice(0, 255) || null, req.utilisateur.id, resa.id], transaction: t });
    await t.commit();
    const [maj] = await charger(boutique_id, { id: resa.id });
    res.json(maj);
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondreErreur(res, e);
  }
};

module.exports.numeroReservation = numeroReservation;
module.exports.charger = charger;
