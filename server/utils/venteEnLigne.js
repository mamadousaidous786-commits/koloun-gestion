// ============================================================
// KOLOUN BOUTIQUE → KOLOUN GESTION : vente automatique
// Quand une livraison issue d'une commande en ligne est marquée « Livrée », la vente est enregistrée
// exactement comme à la caisse (reçu, stock, alertes de stock, client). Les frais de livraison restent
// dans « Livraisons » et ne font pas partie de la vente.
// Si la livraison est remise « à livrer » ou annulée ensuite, la vente est supprimée et le stock restauré.
// ============================================================
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement, Recu, Notification } = require('../models');

const SELECT = { type: sequelize.QueryTypes.SELECT };
const erreur = (code, message) => Object.assign(new Error(message), { code });

// La commande en ligne liée à une livraison (ou null si la livraison a été saisie à la main)
async function commandeDeLaLivraison(livraisonId, transaction) {
  const [c] = await sequelize.query('SELECT * FROM boutique_commandes WHERE livraison_id = ? LIMIT 1', { ...SELECT, replacements: [livraisonId], transaction });
  return c || null;
}

// Même numérotation que les ventes faites à la caisse : KL-AAAAMMJJ-XXXX
async function numeroRecu(transaction) {
  const d = new Date();
  const prefixe = `KL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const n = await Vente.count({ where: { numero_recu: { [Op.like]: `${prefixe}%` } }, transaction });
  return `${prefixe}-${String(n + 1).padStart(4, '0')}`;
}

async function moyenValide(id, transaction) {
  if (id) {
    const m = await MoyenPaiement.findByPk(Number(id), { transaction });
    if (m) return m.id;
  }
  const cash = await MoyenPaiement.findOne({ where: { nom: 'Cash' }, transaction }) || await MoyenPaiement.findOne({ order: [['id', 'ASC']], transaction });
  return cash.id;
}

// Enregistre la vente (dans la transaction fournie). Renvoie la vente, ou null si ce n'est pas une commande en ligne.
async function enregistrerVenteEnLigne(livraison, { utilisateur_id, moyen_paiement_id }, transaction) {
  const cmd = await commandeDeLaLivraison(livraison.id, transaction);
  if (!cmd) return null;
  if (cmd.vente_id) {
    const deja = await Vente.findByPk(cmd.vente_id, { transaction });
    if (deja) return deja; // déjà enregistrée : jamais deux fois
  }

  const lignes = await sequelize.query(
    "SELECT * FROM boutique_commande_lignes WHERE commande_id = ? AND source = 'stock' AND produit_taille_id IS NOT NULL ORDER BY id",
    { ...SELECT, replacements: [cmd.id], transaction });
  if (!lignes.length) return null;

  // Prix accordés (prix négocié par article, puis réduction globale répartie au prorata)
  const prixLigne = (l) => Number(l.prix_negocie ?? l.prix_unitaire);
  const sousTotal = lignes.reduce((s, l) => s + prixLigne(l) * l.quantite, 0);
  const cible = Math.max(0, Math.round(Number(cmd.total_final)));
  const facteur = sousTotal > 0 ? cible / sousTotal : 1;
  const prix = lignes.map((l) => Math.round(prixLigne(l) * facteur));
  const avantDernier = prix.slice(0, -1).reduce((s, p, i) => s + p * lignes[i].quantite, 0);
  const dernier = lignes[lignes.length - 1];
  prix[prix.length - 1] = Math.max(0, Math.round((cible - avantDernier) / dernier.quantite)); // le total tombe juste

  // Stock : même contrôle qu'à la caisse
  const ids = [...new Set(lignes.map((l) => Number(l.produit_taille_id)))];
  const tailles = await ProduitTaille.findAll({
    where: { id: ids },
    include: [{ model: ProduitVariante, attributes: ['id'], include: [{ model: Produit, attributes: ['id', 'nom', 'prix_normal'] }] }],
    transaction, lock: transaction.LOCK.UPDATE,
  });
  const parId = new Map(tailles.map((t) => [t.id, t]));
  const demande = new Map();
  for (const l of lignes) {
    const t = parId.get(Number(l.produit_taille_id));
    if (!t) throw erreur(409, `« ${l.nom} » (taille ${l.taille}) n'existe plus dans les produits : la vente ne peut pas être enregistrée.`);
    demande.set(t.id, (demande.get(t.id) || 0) + Number(l.quantite));
  }
  for (const [id, qte] of demande) {
    const t = parId.get(id);
    if (t.quantite < qte) {
      throw erreur(409, `Stock insuffisant pour « ${t.ProduitVariante.Produit.nom} » (taille ${t.taille} : ${t.quantite} en stock, ${qte} livré${qte > 1 ? 's' : ''}). Corrigez le stock dans Produits, puis validez la livraison.`);
    }
  }

  // Client de Koloun Gestion lié au compte du client (s'il existe)
  let client_id = null;
  if (cmd.compte_client_id) {
    const [cc] = await sequelize.query('SELECT client_id FROM comptes_clients WHERE id = ?', { ...SELECT, replacements: [cmd.compte_client_id], transaction });
    client_id = cc?.client_id || null;
  }

  const vente = await Vente.create({
    boutique_id: livraison.boutique_id,
    utilisateur_id,
    moyen_paiement_id: await moyenValide(moyen_paiement_id, transaction),
    client_id,
    numero_recu: await numeroRecu(transaction),
    montant_total: lignes.reduce((s, l, i) => s + prix[i] * l.quantite, 0),
    observation: `Commande en ligne ${cmd.reference} · livraison ${livraison.numero}`.slice(0, 255),
  }, { transaction });

  await DetailVente.bulkCreate(lignes.map((l, i) => {
    const t = parId.get(Number(l.produit_taille_id));
    return {
      vente_id: vente.id,
      produit_taille_id: t.id,
      produit_nom: t.ProduitVariante.Produit.nom,
      taille_nom: t.taille,
      prix_normal: t.ProduitVariante.Produit.prix_normal,
      quantite: l.quantite,
      prix_applique: prix[i],
      sous_total: prix[i] * l.quantite,
    };
  }), { transaction });

  const notifications = [];
  for (const [id, qte] of demande) {
    const t = parId.get(id);
    await t.decrement('quantite', { by: qte, transaction });
    const reste = t.quantite - qte;
    const nom = t.ProduitVariante.Produit.nom;
    if (reste === 0) notifications.push({ boutique_id: livraison.boutique_id, type: 'rupture_stock', message: `Le produit "${nom}" (taille ${t.taille}) est en rupture de stock.` });
    else if (reste <= t.seuil_alerte) notifications.push({ boutique_id: livraison.boutique_id, type: 'stock_faible', message: `Le stock du produit "${nom}" (taille ${t.taille}) est faible (${reste} restant(s)).` });
  }
  if (notifications.length) await Notification.bulkCreate(notifications, { transaction });

  await Recu.create({ vente_id: vente.id }, { transaction });
  await sequelize.query('UPDATE boutique_commandes SET vente_id = ? WHERE id = ?', { replacements: [vente.id, cmd.id], transaction });
  return vente;
}

// Supprime la vente automatique et remet le stock (livraison remise « à livrer » ou annulée après coup)
async function annulerVenteEnLigne(livraison, transaction) {
  const cmd = await commandeDeLaLivraison(livraison.id, transaction);
  if (!cmd || !cmd.vente_id) return false;
  const vente = await Vente.findByPk(cmd.vente_id, { include: [{ model: DetailVente }], transaction });
  if (vente) {
    for (const d of vente.DetailVentes) {
      if (d.produit_taille_id) await ProduitTaille.increment('quantite', { by: d.quantite, where: { id: d.produit_taille_id }, transaction });
    }
    await vente.destroy({ transaction }); // détails et reçu supprimés en cascade
  }
  await sequelize.query('UPDATE boutique_commandes SET vente_id = NULL WHERE id = ?', { replacements: [cmd.id], transaction });
  return true;
}

module.exports = { enregistrerVenteEnLigne, annulerVenteEnLigne, commandeDeLaLivraison };
