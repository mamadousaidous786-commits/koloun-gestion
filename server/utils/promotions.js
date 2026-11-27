// ============================================================
// PROMOTIONS (ex. : Black Friday -30 %)
// Une promotion = un pourcentage, une période, et la liste des articles concernés
// (figée à la création : les articles ajoutés ensuite restent au prix normal).
// Le prix promo s'applique partout : Koloun Boutique, commandes, réservations, caisse, agent IA.
// À la fin de la période, tout revient au prix normal tout seul.
// ============================================================
const sequelize = require('../config/database');

const SELECT = { type: sequelize.QueryTypes.SELECT };
const nombre = (v) => Math.round(Number(v || 0));
const arrondi = (x) => Math.round(x / 500) * 500; // prix ronds (multiples de 500 GNF)

let cache = { t: 0, boutique: null, liste: [] };
const invalider = () => { cache = { t: 0, boutique: null, liste: [] }; };

// Promotions en cours, avec leurs articles (gardées 30 s en mémoire)
async function enCours(boutique_id) {
  if (cache.boutique === boutique_id && Date.now() - cache.t < 30000) return cache.liste;
  const promos = await sequelize.query(`SELECT id, nom, pourcentage, debut, fin FROM promotions
    WHERE boutique_id = ? AND actif = 1 AND debut <= NOW() AND fin > NOW() ORDER BY pourcentage DESC`, { ...SELECT, replacements: [boutique_id] });
  for (const p of promos) {
    const ids = await sequelize.query('SELECT produit_id FROM promotion_produits WHERE promotion_id = ?', { ...SELECT, replacements: [p.id] });
    p.produits = new Set(ids.map((x) => x.produit_id));
    p.pourcentage = Number(p.pourcentage);
  }
  cache = { t: Date.now(), boutique: boutique_id, liste: promos };
  return promos;
}

// Meilleure promotion pour un article → { prix, prix_avant, promo } (ou prix normal)
function calculer(promos, produitId, prixNormal) {
  const prix = nombre(prixNormal);
  const p = promos.find((x) => x.produits.has(Number(produitId)));
  if (!p) return { prix, prix_avant: null, promo: null };
  return { prix: arrondi((prix * (100 - p.pourcentage)) / 100), prix_avant: prix, promo: { id: p.id, nom: p.nom, pourcentage: p.pourcentage, fin: p.fin } };
}

async function prixDe(boutique_id, produitId, prixNormal) {
  return calculer(await enCours(boutique_id), produitId, prixNormal);
}

// Ajoute prix promo / prix barré à une liste d'objets { id, prix } (prix = prix normal)
async function appliquer(boutique_id, produits, { champId = 'id', champPrix = 'prix' } = {}) {
  const promos = await enCours(boutique_id);
  if (!promos.length) return produits;
  for (const x of produits) {
    const r = calculer(promos, x[champId], x[champPrix]);
    if (r.promo) Object.assign(x, { [champPrix]: r.prix, prix_avant: r.prix_avant, promo: r.promo });
  }
  return produits;
}

module.exports = { enCours, calculer, prixDe, appliquer, invalider, arrondi };
