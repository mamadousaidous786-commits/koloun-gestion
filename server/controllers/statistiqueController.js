const { sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement, Notification, Dette, PaiementDette, CommandeSpeciale, Depense } = require('../models');
const { avecSoldeDette } = require('../utils/soldes');
const { Op, fn, col, literal } = require('sequelize');

// GET /api/statistiques/dashboard-admin
exports.dashboardAdmin = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

    const compteStock = (condition) => ProduitTaille.count({
      where: condition,
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });

    // Toutes les requêtes partent en même temps : l'affichage prend le temps d'UNE seule requête
    const [
      chiffreAffairesJourBrut, chiffreAffairesMoisBrut, nombreVentesJour, produitsEnRupture, produitsStockFaible,
      ventesParPaiement, notificationsNonLues, dettesBrutes, commandesSpecialesEnCours, commandesSpecialesArrivees, depensesMoisBrut,
    ] = await Promise.all([
      Vente.sum('montant_total', { where: { boutique_id, date_vente: { [Op.gte]: debutJour } } }),
      Vente.sum('montant_total', { where: { boutique_id, date_vente: { [Op.gte]: debutMois } } }),
      Vente.count({ where: { boutique_id, date_vente: { [Op.gte]: debutJour } } }),
      compteStock({ quantite: 0 }),
      compteStock({ quantite: { [Op.gt]: 0, [Op.lte]: sequelize.col('ProduitTaille.seuil_alerte') } }),
      Vente.findAll({
        where: { boutique_id, date_vente: { [Op.gte]: debutMois } },
        attributes: ['moyen_paiement_id', [fn('SUM', col('montant_total')), 'total']],
        include: [{ model: MoyenPaiement, attributes: ['nom'] }],
        group: ['moyen_paiement_id', 'MoyenPaiement.id'],
      }),
      Notification.count({ where: { boutique_id, lue: false } }),
      Dette.findAll({ where: { boutique_id }, include: [{ model: PaiementDette, as: 'paiements' }] }),
      CommandeSpeciale.count({ where: { boutique_id, statut: { [Op.in]: ['en_attente', 'commandee', 'arrivee'] } } }),
      CommandeSpeciale.count({ where: { boutique_id, statut: 'arrivee' } }),
      Depense.sum('montant', { where: { boutique_id, date_depense: { [Op.gte]: debutMois.toISOString().slice(0, 10) } } }),
    ]);
    const chiffreAffairesJour = chiffreAffairesJourBrut || 0;
    const chiffreAffairesMois = chiffreAffairesMoisBrut || 0;
    const depensesMois = depensesMoisBrut || 0;
    const dettesEnCours = dettesBrutes.map(avecSoldeDette).filter((d) => !d.soldee);

    res.json({
      dettes_total_restant: dettesEnCours.reduce((a, d) => a + d.reste, 0),
      dettes_nombre: dettesEnCours.length,
      dettes_en_retard: dettesEnCours.filter((d) => d.en_retard).length,
      commandes_speciales_en_cours: commandesSpecialesEnCours,
      commandes_speciales_arrivees: commandesSpecialesArrivees,
      depenses_mois: Number(depensesMois),
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

    const compteStock = (condition) => ProduitTaille.count({
      where: condition,
      include: [{ model: ProduitVariante, attributes: [], include: [{ model: Produit, attributes: [], where: { boutique_id } }] }],
    });
    const [ventesJourBrut, ventesMoisBrut, dernieresVentes, produitsDisponibles, produitsEnRupture] = await Promise.all([
      Vente.sum('montant_total', { where: { boutique_id, utilisateur_id, date_vente: { [Op.gte]: debutJour } } }),
      Vente.sum('montant_total', { where: { boutique_id, utilisateur_id, date_vente: { [Op.gte]: debutMois } } }),
      Vente.findAll({ where: { boutique_id, utilisateur_id }, order: [['date_vente', 'DESC']], limit: 5 }),
      compteStock({ quantite: { [Op.gt]: 0 } }),
      compteStock({ quantite: 0 }),
    ]);
    const ventesJour = ventesJourBrut || 0;
    const ventesMois = ventesMoisBrut || 0;

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

// GET /api/statistiques/graphiques -- toutes les données des graphiques en une seule réponse
exports.graphiques = async (req, res) => {
  try {
    const b = req.utilisateur.boutique_id;
    const q = (sql) => sequelize.query(sql, { replacements: { b }, type: sequelize.QueryTypes.SELECT });

    const [ventes30, mois, depensesMois, achatsMois, paiements, produits, jours, heures, vendeurs, clients] = await Promise.all([
      q(`SELECT DATE_FORMAT(date_vente,'%Y-%m-%d') AS jour, SUM(montant_total) AS total, COUNT(*) AS nb
         FROM ventes WHERE boutique_id=:b AND date_vente >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY jour ORDER BY jour`),
      q(`SELECT DATE_FORMAT(date_vente,'%Y-%m') AS mois, SUM(montant_total) AS total
         FROM ventes WHERE boutique_id=:b AND date_vente >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 5 MONTH)
         GROUP BY mois ORDER BY mois`),
      q(`SELECT DATE_FORMAT(date_depense,'%Y-%m') AS mois, SUM(montant) AS total
         FROM depenses WHERE boutique_id=:b AND date_depense >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 5 MONTH)
         GROUP BY mois`),
      q(`SELECT DATE_FORMAT(date_commande,'%Y-%m') AS mois, SUM(montant_total + COALESCE(transport,0)) AS total
         FROM commandes WHERE boutique_id=:b AND date_commande >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 5 MONTH)
         GROUP BY mois`),
      q(`SELECT m.nom AS nom, SUM(v.montant_total) AS total, COUNT(*) AS nb
         FROM ventes v JOIN moyens_paiement m ON m.id = v.moyen_paiement_id
         WHERE v.boutique_id=:b AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY m.nom ORDER BY total DESC`),
      q(`SELECT p.nom AS nom, SUM(d.quantite) AS quantite, SUM(d.sous_total) AS chiffre_affaires
         FROM details_ventes d
         JOIN ventes v ON v.id = d.vente_id
         JOIN produit_tailles pt ON pt.id = d.produit_taille_id
         JOIN produit_variantes pv ON pv.id = pt.produit_variante_id
         JOIN produits p ON p.id = pv.produit_id
         WHERE v.boutique_id=:b AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY p.id, p.nom ORDER BY quantite DESC LIMIT 8`),
      q(`SELECT DAYOFWEEK(date_vente) AS jour, SUM(montant_total) AS total, COUNT(*) AS nb
         FROM ventes WHERE boutique_id=:b AND date_vente >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY jour ORDER BY jour`),
      q(`SELECT HOUR(date_vente) AS heure, COUNT(*) AS nb
         FROM ventes WHERE boutique_id=:b AND date_vente >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY heure ORDER BY heure`),
      q(`SELECT CONCAT(COALESCE(u.prenom,''),' ',u.nom) AS nom, SUM(v.montant_total) AS total, COUNT(*) AS nb
         FROM ventes v JOIN utilisateurs u ON u.id = v.utilisateur_id
         WHERE v.boutique_id=:b AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY u.id, u.nom, u.prenom ORDER BY total DESC LIMIT 8`),
      q(`SELECT c.nom AS nom, SUM(v.montant_total) AS total, COUNT(*) AS nb
         FROM ventes v JOIN clients c ON c.id = v.client_id
         WHERE v.boutique_id=:b AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
         GROUP BY c.id, c.nom ORDER BY total DESC LIMIT 5`),
    ]);

    res.json({ ventes30, mois, depensesMois, achatsMois, paiements, produits, jours, heures, vendeurs, clients });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
