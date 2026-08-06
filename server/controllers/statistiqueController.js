const { sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement, Notification } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// GET /api/statistiques/dashboard-admin
exports.dashboardAdmin = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

    const chiffreAffairesJour = await Vente.sum('montant_total', {
      where: { boutique_id, date_vente: { [Op.gte]: debutJour } },
    }) || 0;

    const chiffreAffairesMois = await Vente.sum('montant_total', {
      where: { boutique_id, date_vente: { [Op.gte]: debutMois } },
    }) || 0;

    const nombreVentesJour = await Vente.count({
      where: { boutique_id, date_vente: { [Op.gte]: debutJour } },
    });

    const produitsEnRupture = await ProduitTaille.count({
      where: { quantite: 0 },
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });
    const produitsStockFaible = await ProduitTaille.count({
      where: { quantite: { [Op.gt]: 0, [Op.lte]: sequelize.col('ProduitTaille.seuil_alerte') } },
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });

    const ventesParPaiement = await Vente.findAll({
      where: { boutique_id, date_vente: { [Op.gte]: debutMois } },
      attributes: [
        'moyen_paiement_id',
        [fn('SUM', col('montant_total')), 'total'],
      ],
      include: [{ model: MoyenPaiement, attributes: ['nom'] }],
      group: ['moyen_paiement_id', 'MoyenPaiement.id'],
    });

    const notificationsNonLues = await Notification.count({ where: { boutique_id, lue: false } });

    res.json({
      chiffre_affaires_jour: chiffreAffairesJour,
      chiffre_affaires_mois: chiffreAffairesMois,
      nombre_ventes_jour: nombreVentesJour,
      produits_en_rupture: produitsEnRupture,
      produits_stock_faible: produitsStockFaible,
      ventes_par_moyen_paiement: ventesParPaiement,
      notifications_non_lues: notificationsNonLues,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/statistiques/dashboard-utilisateur
exports.dashboardUtilisateur = async (req, res) => {
  try {
    const { boutique_id, id: utilisateur_id } = req.utilisateur;
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

    const ventesJour = await Vente.sum('montant_total', {
      where: { boutique_id, utilisateur_id, date_vente: { [Op.gte]: debutJour } },
    }) || 0;

    const ventesMois = await Vente.sum('montant_total', {
      where: { boutique_id, utilisateur_id, date_vente: { [Op.gte]: debutMois } },
    }) || 0;

    const dernieresVentes = await Vente.findAll({
      where: { boutique_id, utilisateur_id },
      order: [['date_vente', 'DESC']],
      limit: 5,
    });

    const produitsDisponibles = await ProduitTaille.count({
      where: { quantite: { [Op.gt]: 0 } },
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });
    const produitsEnRupture = await ProduitTaille.count({
      where: { quantite: 0 },
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });

    res.json({
      ventes_jour: ventesJour,
      ventes_mois: ventesMois,
      dernieres_ventes: dernieresVentes,
      produits_disponibles: produitsDisponibles,
      produits_en_rupture: produitsEnRupture,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/statistiques/produits-plus-vendus
exports.produitsPlusVendus = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;

    const resultats = await DetailVente.findAll({
      attributes: [
        [fn('SUM', col('DetailVente.quantite')), 'quantite_vendue'],
        [fn('SUM', col('DetailVente.sous_total')), 'chiffre_affaires'],
      ],
      include: [
        { model: ProduitTaille, attributes: [], include: [{ model: ProduitVariante, attributes: ['produit_id'], include: [{ model: Produit, attributes: ['nom'], where: { boutique_id } }] }] },
        { model: Vente, attributes: [], where: { boutique_id } },
      ],
      group: ['ProduitTaille->ProduitVariante->Produit.id'],
      order: [[literal('quantite_vendue'), 'DESC']],
      limit: 10,
    });

    res.json(resultats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/statistiques/recherche?terme=xxx
exports.rechercheIntelligente = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { terme } = req.query;

    const resultats = await DetailVente.findAll({
      include: [
        { model: ProduitTaille, include: [{ model: ProduitVariante, include: [{ model: Produit, where: { boutique_id, nom: { [Op.like]: `%${terme}%` } } }] }] },
        { model: Vente, where: { boutique_id }, include: [MoyenPaiement] },
      ],
    });

    const nombreVendu = resultats.reduce((acc, r) => acc + r.quantite, 0);
    const chiffreAffaires = resultats.reduce((acc, r) => acc + Number(r.sous_total), 0);

    const parMoyenPaiement = {};
    resultats.forEach((r) => {
      const nomMoyen = r.Vente.MoyenPaiement.nom;
      parMoyenPaiement[nomMoyen] = (parMoyenPaiement[nomMoyen] || 0) + Number(r.sous_total);
    });

    res.json({
      terme,
      nombre_vendu: nombreVendu,
      chiffre_affaires: chiffreAffaires,
      repartition_paiement: parMoyenPaiement,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/statistiques/comptabilite?date=YYYY-MM-DD
// Pour chaque article vendu ce jour-là : total encaissé par moyen de paiement
exports.comptabilite = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const dateChoisie = req.query.date || new Date().toISOString().slice(0, 10);

    const details = await DetailVente.findAll({
      include: [
        { model: ProduitTaille, include: [{ model: ProduitVariante, include: [{ model: Produit, attributes: ['id', 'nom'] }] }] },
        {
          model: Vente,
          where: {
            boutique_id,
            [Op.and]: [sequelize.where(sequelize.fn('DATE', sequelize.col('Vente.date_vente')), dateChoisie)],
          },
          include: [MoyenPaiement],
        },
      ],
    });

    // Regroupement par produit puis par moyen de paiement
    const parProduit = {};
    let totalGeneral = 0;
    const totalParMoyen = {};

    details.forEach((detail) => {
      const nomProduit = detail.ProduitTaille.ProduitVariante.Produit.nom;
      const nomMoyen = detail.Vente.MoyenPaiement.nom;
      const montant = Number(detail.sous_total);

      if (!parProduit[nomProduit]) parProduit[nomProduit] = { produit: nomProduit, total: 0 };
      parProduit[nomProduit][nomMoyen] = (parProduit[nomProduit][nomMoyen] || 0) + montant;
      parProduit[nomProduit].total += montant;

      totalParMoyen[nomMoyen] = (totalParMoyen[nomMoyen] || 0) + montant;
      totalGeneral += montant;
    });

    res.json({
      date: dateChoisie,
      articles: Object.values(parProduit),
      total_par_moyen_paiement: totalParMoyen,
      total_general: totalGeneral,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
