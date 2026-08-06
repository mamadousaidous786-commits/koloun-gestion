const path = require('path');
const fs = require('fs');
const { sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement, Utilisateur, Recu, Notification } = require('../models');
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
exports.creerVente = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { articles, moyen_paiement_id, observation } = req.body;
    // articles = [{ produit_taille_id, quantite, prix_applique }]

    if (!articles || articles.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Aucun article dans la vente.' });
    }

    let montantTotal = 0;
    const detailsAVerifier = [];

    for (const article of articles) {
      const taille = await ProduitTaille.findOne({
        where: { id: article.produit_taille_id },
        include: [{ model: ProduitVariante, include: [{ model: Produit, where: { boutique_id: req.utilisateur.boutique_id } }] }],
        transaction,
      });
      if (!taille) throw new Error(`Article introuvable.`);
      if (taille.quantite < article.quantite) {
        throw new Error(`Stock insuffisant pour "${taille.ProduitVariante.Produit.nom}" (taille ${taille.taille}, disponible: ${taille.quantite}).`);
      }

      const sousTotal = article.prix_applique * article.quantite;
      montantTotal += sousTotal;
      detailsAVerifier.push({ taille, sousTotal });
    }

    const numeroRecu = await genererNumeroRecu();

    const vente = await Vente.create({
      boutique_id: req.utilisateur.boutique_id,
      utilisateur_id: req.utilisateur.id,
      moyen_paiement_id,
      numero_recu: numeroRecu,
      montant_total: montantTotal,
      observation,
    }, { transaction });

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const { taille, sousTotal } = detailsAVerifier[i];

      await DetailVente.create({
        vente_id: vente.id,
        produit_taille_id: article.produit_taille_id,
        quantite: article.quantite,
        prix_applique: article.prix_applique,
        sous_total: sousTotal,
      }, { transaction });

      taille.quantite -= article.quantite;
      await taille.save({ transaction });

      if (taille.quantite === 0) {
        await Notification.create({
          boutique_id: req.utilisateur.boutique_id,
          type: 'rupture_stock',
          message: `Le produit "${taille.ProduitVariante.Produit.nom}" (taille ${taille.taille}) est en rupture de stock.`,
        }, { transaction });
      } else if (taille.quantite <= taille.seuil_alerte) {
        await Notification.create({
          boutique_id: req.utilisateur.boutique_id,
          type: 'stock_faible',
          message: `Le stock du produit "${taille.ProduitVariante.Produit.nom}" (taille ${taille.taille}) est faible (${taille.quantite} restant(s)).`,
        }, { transaction });
      }
    }

    await Recu.create({ vente_id: vente.id }, { transaction });

    await transaction.commit();

    const venteComplete = await Vente.findByPk(vente.id, {
      include: [
        { model: DetailVente, include: [{ model: ProduitTaille, include: [{ model: ProduitVariante, include: [Produit] }] }] },
        { model: MoyenPaiement },
        { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
      ],
    });

    res.status(201).json(venteComplete);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

// GET /api/ventes
exports.listerVentes = async (req, res) => {
  try {
    const { debut, fin } = req.query;
    const filtre = { boutique_id: req.utilisateur.boutique_id };

    if (debut && fin) {
      filtre.date_vente = { [Op.between]: [new Date(debut), new Date(fin)] };
    }

    if (req.utilisateur.role !== 'admin') {
      filtre.utilisateur_id = req.utilisateur.id;
    }

    const ventes = await Vente.findAll({
      where: filtre,
      include: [
        { model: DetailVente, include: [{ model: ProduitTaille, include: [{ model: ProduitVariante, include: [Produit] }] }] },
        { model: MoyenPaiement },
        { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
      ],
      order: [['date_vente', 'DESC']],
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
