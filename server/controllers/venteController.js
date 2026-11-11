const path = require('path');
const fs = require('fs');
const { sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement, Utilisateur, Recu, Notification, Client } = require('../models');
const { Op } = require('sequelize');

// Génère un numéro de reçu unique : KL-YYYYMMDD-XXXX
async function genererNumeroRecu() {
  const aujourdhui = new Date();
  const prefixe = `KL-${aujourdhui.getFullYear()}${String(aujourdhui.getMonth() + 1).padStart(2, '0')}${String(aujourdhui.getDate()).padStart(2, '0')}`;
  const compte = await Vente.count({
    where: { numero_recu: { [Op.like]: `${prefixe}%` } },
  });
  return `${prefixe}-${String(compte + 1).padStart(4, '0')}`;
}

// POST /api/ventes  -- Enregistrer une vente (plusieurs tailles/produits, prix modifiable = réduction possible)
// Optimisé : lectures en parallèle AVANT la transaction, puis très peu d'écritures groupées
// (chaque aller-retour vers la base coûte du temps, donc on en fait le moins possible).
exports.creerVente = async (req, res) => {
  const { articles, moyen_paiement_id, observation } = req.body;
  const boutique_id = req.utilisateur.boutique_id;
  let client_id = req.body.client_id || null;

  if (!Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ message: 'Aucun article dans la vente.' });
  }

  let transaction;
  try {
    // ---- 1) Lectures en parallèle (hors transaction) ----
    const ids = [...new Set(articles.map((a) => Number(a.produit_taille_id)))];
    const [tailles, client, numeroRecu] = await Promise.all([
      ProduitTaille.findAll({
        where: { id: ids },
        include: [{ model: ProduitVariante, attributes: ['id'], include: [{ model: Produit, attributes: ['id', 'nom'], where: { boutique_id } }] }],
      }),
      client_id ? Client.findOne({ where: { id: client_id, boutique_id }, attributes: ['id'] }) : null,
      genererNumeroRecu(),
    ]);
    if (client_id && !client) client_id = null;
    const parId = new Map(tailles.map((t) => [t.id, t]));

    // Quantité totale demandée par taille (au cas où la même taille serait ajoutée deux fois)
    const demande = new Map();
    let montantTotal = 0;
    for (const article of articles) {
      const taille = parId.get(Number(article.produit_taille_id));
      if (!taille) throw new Error('Article introuvable.');
      demande.set(taille.id, (demande.get(taille.id) || 0) + Number(article.quantite));
      montantTotal += Number(article.prix_applique) * Number(article.quantite);
    }
    for (const [id, qte] of demande) {
      const taille = parId.get(id);
      if (taille.quantite < qte) {
        throw new Error(`Stock insuffisant pour "${taille.ProduitVariante.Produit.nom}" (taille ${taille.taille}, disponible: ${taille.quantite}).`);
      }
    }

    // ---- 2) Écritures groupées dans une transaction ----
    transaction = await sequelize.transaction();

    const vente = await Vente.create({
      boutique_id, utilisateur_id: req.utilisateur.id, moyen_paiement_id, client_id,
      numero_recu: numeroRecu, montant_total: montantTotal, observation,
    }, { transaction });

    await DetailVente.bulkCreate(articles.map((a) => ({
      vente_id: vente.id,
      produit_taille_id: a.produit_taille_id,
      quantite: a.quantite,
      prix_applique: a.prix_applique,
      sous_total: Number(a.prix_applique) * Number(a.quantite),
    })), { transaction });

    // Décrément du stock en UNE requête, protégé contre deux ventes simultanées
    const cas = [...demande].map(([id, qte]) => `WHEN ${Number(id)} THEN ${Number(qte)}`).join(' ');
    const [, lignesModifiees] = await sequelize.query(
      `UPDATE produit_tailles SET quantite = quantite - CASE id ${cas} END
       WHERE id IN (${[...demande.keys()].map(Number).join(',')}) AND quantite >= CASE id ${cas} END`,
      { transaction }
    );
    const modifiees = typeof lignesModifiees === 'number' ? lignesModifiees : lignesModifiees?.affectedRows;
    if (modifiees !== demande.size) throw new Error('Stock insuffisant : un autre vendeur vient de vendre ce produit.');

    // Alertes de stock (une seule insertion)
    const notifications = [];
    for (const [id, qte] of demande) {
      const taille = parId.get(id);
      const reste = taille.quantite - qte;
      const nom = taille.ProduitVariante.Produit.nom;
      if (reste === 0) notifications.push({ boutique_id, type: 'rupture_stock', message: `Le produit "${nom}" (taille ${taille.taille}) est en rupture de stock.` });
      else if (reste <= taille.seuil_alerte) notifications.push({ boutique_id, type: 'stock_faible', message: `Le stock du produit "${nom}" (taille ${taille.taille}) est faible (${reste} restant(s)).` });
    }
    if (notifications.length) await Notification.bulkCreate(notifications, { transaction });

    await Recu.create({ vente_id: vente.id }, { transaction });
    await transaction.commit();

    // Réponse immédiate (le détail complet est dans le reçu)
    res.status(201).json(vente);
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    res.status(400).json({ message: error.message });
  }
};

// GET /api/ventes
exports.listerVentes = async (req, res) => {
  try {
    const { debut, fin, jour } = req.query;
    const filtre = { boutique_id: req.utilisateur.boutique_id };
    const admin = req.utilisateur.role === 'admin';

    // Un jour précis (AAAA-MM-JJ). Le vendeur ne voit QUE les ventes d'aujourd'hui.
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const jourDemande = admin ? jour : aujourdhui;

    if (jourDemande) {
      const debutJour = new Date(`${jourDemande}T00:00:00.000Z`);
      const finJour = new Date(`${jourDemande}T23:59:59.999Z`);
      filtre.date_vente = { [Op.between]: [debutJour, finJour] };
    } else if (debut && fin) {
      filtre.date_vente = { [Op.between]: [new Date(debut), new Date(fin)] };
    } else {
      // Administrateur sans filtre : les 30 derniers jours (liste légère et rapide)
      filtre.date_vente = { [Op.gte]: new Date(Date.now() - 30 * 24 * 3600 * 1000) };
    }

    if (!admin) filtre.utilisateur_id = req.utilisateur.id;

    // Liste légère : pas besoin du détail des articles (il est dans le reçu)
    const ventes = await Vente.findAll({
      where: filtre,
      include: [
        { model: MoyenPaiement },
        { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
        { model: Client, attributes: ['id', 'nom', 'telephone'] },
      ],
      order: [['date_vente', 'DESC']],
      limit: 500,
    });

    res.json(ventes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/ventes/:id
exports.obtenirVente = async (req, res) => {
  try {
    const vente = await Vente.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
      include: [
        { model: DetailVente, include: [{ model: ProduitTaille, include: [{ model: ProduitVariante, include: [Produit] }] }] },
        { model: MoyenPaiement },
        { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
        { model: Recu },
      ],
    });
    if (!vente) return res.status(404).json({ message: 'Vente introuvable.' });
    res.json(vente);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/ventes/:id -- Supprime une vente, restaure le stock et supprime le reçu PDF
exports.supprimerVente = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const vente = await Vente.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
      include: [{ model: DetailVente }, { model: Recu }],
      transaction,
    });
    if (!vente) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Vente introuvable.' });
    }

    // Restaure le stock pour chaque article vendu
    for (const detail of vente.DetailVentes) {
      const taille = await ProduitTaille.findByPk(detail.produit_taille_id, { transaction });
      if (taille) {
        taille.quantite += detail.quantite;
        await taille.save({ transaction });
      }
    }

    // Supprime le fichier PDF du reçu s'il existe
    if (vente.Recu?.chemin_pdf) {
      const cheminAbsolu = path.join(__dirname, '..', vente.Recu.chemin_pdf);
      fs.unlink(cheminAbsolu, () => {}); // ignore si le fichier est déjà absent
    }

    await vente.destroy({ transaction }); // cascade sur DetailVente et Recu

    await transaction.commit();
    res.json({ message: 'Vente supprimée et stock restauré avec succès.' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
