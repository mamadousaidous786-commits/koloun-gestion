// ============================================================
// KOLOUN BOUTIQUE → réservation par le client (compte obligatoire)
// La réservation arrive dans Koloun Gestion → Réservations, « À confirmer ». Le stock n'est pas encore touché :
// c'est la confirmation du vendeur qui met les articles de côté (et retire le stock).
// Compte Google sans numéro : le numéro est demandé une fois et enregistré dans le compte.
// ============================================================
const sequelize = require('../config/database');
const { Notification } = require('../models');
const { numeroReservation } = require('./reservationController');
const { normaliserTelephone, publique, lierClientGestion } = require('./compteController');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = [], tr) => sequelize.query(t, { ...SELECT, replacements: r, transaction: tr });
const exec = (t, r = [], tr) => sequelize.query(t, { replacements: r, transaction: tr });
const erreur = (code, message) => Object.assign(new Error(message), { code });
const repondre = (res, e, defaut) => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code && e.code < 500 ? e.message : defaut, erreur: e.code && e.code < 500 ? undefined : e.message });
const gnf = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} GNF`;

// Réservations d'un compte client (pour « Mon compte »)
async function reservationsDuCompte(compteId) {
  const liste = await sql(`SELECT id, numero, statut, total, motif, date_retrait_prevue, created_at, date_confirmation, date_traitement
    FROM reservations WHERE boutique_id = ? AND compte_client_id = ? ORDER BY created_at DESC LIMIT 50`, [BOUTIQUE_ID, compteId]);
  if (!liste.length) return [];
  const articles = await sql(`SELECT reservation_id, produit_nom, taille, quantite, prix, image FROM reservation_articles
    WHERE reservation_id IN (${liste.map((r) => Number(r.id)).join(',')}) ORDER BY id`);
  return liste.map((r) => {
    const a = articles.filter((x) => x.reservation_id === r.id);
    return {
      numero: r.numero, statut: r.statut, total: Math.round(Number(r.total)), motif: r.motif,
      date: r.created_at, date_retrait_prevue: r.date_retrait_prevue, date_confirmation: r.date_confirmation,
      nb: a.reduce((s, x) => s + x.quantite, 0), image: a[0]?.image || null,
      articles: a.map((x) => ({ nom: x.produit_nom, taille: x.taille, quantite: x.quantite, prix: Math.round(Number(x.prix)) })),
    };
  });
}
exports.reservationsDuCompte = reservationsDuCompte;

// POST /api/boutique/compte/reservations { lignes: [{ produit_taille_id, quantite }], telephone?, date_retrait_prevue?, note? }
exports.reserver = async (req, res) => {
  let t;
  try {
    const [c] = await sql('SELECT * FROM comptes_clients WHERE id = ? AND actif = 1', [req.compte.compte_id]);
    if (!c) throw erreur(401, 'Compte introuvable. Reconnectez-vous.');

    // Téléphone : celui du compte, sinon celui saisi (comptes Google), enregistré dans le compte
    let telephone = c.telephone;
    let compteMaj = null;
    if (!telephone) {
      telephone = normaliserTelephone(req.body.telephone);
      if (!telephone) throw erreur(400, 'Indiquez votre numéro de téléphone : la boutique vous appelle pour confirmer la réservation.');
      const [pris] = await sql('SELECT id FROM comptes_clients WHERE boutique_id = ? AND telephone = ? AND id <> ?', [c.boutique_id, telephone, c.id]);
      if (!pris) {
        await exec('UPDATE comptes_clients SET telephone = ? WHERE id = ?', [telephone, c.id]);
        [compteMaj] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [c.id]);
        await lierClientGestion({ ...compteMaj, telephone_saisi: req.body.telephone }).catch(() => {});
        [compteMaj] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [c.id]);
      }
    }

    // Pas plus de 5 réservations en attente de confirmation par compte (évite les abus)
    const [enCours] = await sql("SELECT COUNT(*) AS n FROM reservations WHERE compte_client_id = ? AND statut = 'a_confirmer'", [c.id]);
    if (Number(enCours.n) >= 5) throw erreur(429, 'Vous avez déjà 5 réservations en attente de confirmation. Patientez ou contactez la boutique.');

    const demandes = (Array.isArray(req.body.lignes) ? req.body.lignes : [])
      .map((l) => ({ id: Number(l.produit_taille_id), quantite: Math.min(20, Math.max(1, Math.floor(Number(l.quantite) || 1))) }))
      .filter((l) => l.id);
    if (!demandes.length) throw erreur(400, 'Votre panier est vide.');
    const total = new Map(); demandes.forEach((d) => total.set(d.id, (total.get(d.id) || 0) + d.quantite));

    const tailles = await sql(`SELECT t.id, t.taille, t.quantite, v.image, p.id AS produit_id, p.nom, p.prix_normal
      FROM produit_tailles t JOIN produit_variantes v ON v.id = t.produit_variante_id JOIN produits p ON p.id = v.produit_id
      WHERE t.id IN (${[...total.keys()].join(',')}) AND p.boutique_id = ? AND COALESCE(p.visible_boutique, 1) = 1`, [BOUTIQUE_ID]);
    const parId = new Map(tailles.map((x) => [x.id, x]));
    for (const [id, qte] of total) {
      const x = parId.get(id);
      if (!x) throw erreur(409, "Un article de votre panier n'est plus disponible. Retirez-le puis réessayez.");
      if (Number(x.quantite) < qte) throw erreur(409, `« ${x.nom} » en taille ${x.taille} : il n'en reste que ${Math.max(0, x.quantite)}.`);
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date_retrait_prevue || '')) ? req.body.date_retrait_prevue : null;
    const lignes = [...total].map(([id, qte]) => ({ x: parId.get(id), qte }));
    const somme = lignes.reduce((s, l) => s + Math.round(Number(l.x.prix_normal)) * l.qte, 0);

    t = await sequelize.transaction();
    const numero = await numeroReservation(BOUTIQUE_ID, t);
    const [resaId] = await sequelize.query(
      `INSERT INTO reservations (boutique_id, numero, client_id, client_nom, client_telephone, date_retrait_prevue, note, total, statut, source, compte_client_id, stock_bloque)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'a_confirmer', 'boutique', ?, 0)`,
      { replacements: [BOUTIQUE_ID, numero, (compteMaj || c).client_id || null, String(c.nom).slice(0, 150), telephone, date,
        String(req.body.note || '').trim().slice(0, 255) || null, somme, c.id], type: sequelize.QueryTypes.INSERT, transaction: t });
    for (const { x, qte } of lignes) {
      await exec('INSERT INTO reservation_articles (reservation_id, produit_taille_id, produit_nom, taille, image, prix_normal, prix, quantite) VALUES (?,?,?,?,?,?,?,?)',
        [resaId, x.id, x.nom, x.taille, x.image, x.prix_normal, x.prix_normal, qte], t);
    }
    await Notification.create({ boutique_id: BOUTIQUE_ID, type: 'reservation_en_ligne', message: `Nouvelle réservation en ligne ${numero} : ${String(c.nom).slice(0, 40)}, ${gnf(somme)}. À confirmer dans Réservations.`.slice(0, 255) }, { transaction: t });
    await t.commit();
    res.status(201).json({ numero, total: somme, compte: compteMaj ? publique(compteMaj) : undefined });
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondre(res, e, "La réservation n'a pas pu être envoyée.");
  }
};

// POST /api/boutique/compte/reservations/:numero/annuler — tant que la boutique ne l'a pas confirmée
exports.annuler = async (req, res) => {
  try {
    const [r] = await sql('SELECT id, statut FROM reservations WHERE boutique_id = ? AND numero = ? AND compte_client_id = ?', [BOUTIQUE_ID, req.params.numero, req.compte.compte_id]);
    if (!r) throw erreur(404, 'Réservation introuvable.');
    if (r.statut !== 'a_confirmer') throw erreur(400, 'La boutique a déjà confirmé cette réservation : contactez-la pour l\'annuler.');
    await exec("UPDATE reservations SET statut = 'annulee', motif = 'Annulée par le client', date_traitement = NOW() WHERE id = ?", [r.id]);
    res.json({ ok: true });
  } catch (e) { repondre(res, e, "L'annulation n'a pas abouti."); }
};
