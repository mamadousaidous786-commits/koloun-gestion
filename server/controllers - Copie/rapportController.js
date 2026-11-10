const {
  sequelize, Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, MoyenPaiement,
  Depense, Commande, CommandeSpeciale, PaiementCommandeSpeciale, Dette, PaiementDette, Boutique,
} = require('../models');
const { Op } = require('sequelize');
const { bornesDuMois } = require('./depenseController');
const { avecSoldeDette } = require('../utils/soldes');

// GET /api/rapports/mensuel?mois=YYYY-MM
exports.mensuel = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { mois, debut, fin } = bornesDuMois(req.query.mois);
    const boutique = await Boutique.findByPk(boutique_id);

    // ---- Ventes ----
    const filtreDate = (colonne) => sequelize.where(sequelize.fn('DATE', sequelize.col(colonne)), { [Op.between]: [debut, fin] });

    const ventes = await Vente.findAll({
      where: { boutique_id, [Op.and]: [filtreDate('Vente.date_vente')] },
      include: [{ model: MoyenPaiement }],
    });
    const parMoyen = {};
    const parJour = {};
    let totalVentes = 0;
    ventes.forEach((v) => {
      const m = Number(v.montant_total);
      totalVentes += m;
      const nom = v.MoyenPaiement?.nom || 'Autre';
      parMoyen[nom] = (parMoyen[nom] || 0) + m;
      const jour = new Date(v.date_vente).toISOString().slice(0, 10);
      parJour[jour] = (parJour[jour] || 0) + m;
    });

    // ---- Produits les plus vendus ----
    const details = await DetailVente.findAll({
      include: [
        { model: ProduitTaille, include: [{ model: ProduitVariante, include: [{ model: Produit, attributes: ['id', 'nom'] }] }] },
        { model: Vente, attributes: [], where: { boutique_id, [Op.and]: [filtreDate('Vente.date_vente')] } },
      ],
    });
    const parProduit = {};
    details.forEach((d) => {
      const nom = d.ProduitTaille?.ProduitVariante?.Produit?.nom || 'Produit supprimé';
      if (!parProduit[nom]) parProduit[nom] = { produit: nom, quantite: 0, montant: 0 };
      parProduit[nom].quantite += d.quantite;
      parProduit[nom].montant += Number(d.sous_total);
    });
    const topProduits = Object.values(parProduit).sort((a, b) => b.quantite - a.quantite).slice(0, 8);

    // ---- Dépenses ----
    const depenses = await Depense.findAll({ where: { boutique_id, date_depense: { [Op.between]: [debut, fin] } } });
    const depensesParCategorie = {};
    let totalDepenses = 0;
    depenses.forEach((d) => {
      const m = Number(d.montant);
      totalDepenses += m;
      depensesParCategorie[d.categorie] = (depensesParCategorie[d.categorie] || 0) + m;
    });

    // ---- Achats fournisseurs (commandes) ----
    const commandes = await Commande.findAll({ where: { boutique_id, date_commande: { [Op.between]: [debut, fin] } } });
    const achatsFournisseurs = commandes.reduce((a, c) => a + Number(c.montant_total) + Number(c.transport || 0), 0);

    // ---- Commandes spéciales : paiements reçus ce mois ----
    const paiementsCmd = await PaiementCommandeSpeciale.findAll({
      where: { [Op.and]: [filtreDate('PaiementCommandeSpeciale.date_paiement')] },
      include: [{ model: CommandeSpeciale, attributes: [], where: { boutique_id } }],
    });
    const encaisseCommandesSpeciales = paiementsCmd.reduce((a, p) => a + Number(p.montant), 0);
    const commandesSpecialesCreees = await CommandeSpeciale.count({
      where: { boutique_id, [Op.and]: [filtreDate('CommandeSpeciale.created_at')] },
    });

    // ---- Dettes : remboursements reçus ce mois + reste global ----
    const paiementsDettes = await PaiementDette.findAll({
      where: { [Op.and]: [filtreDate('PaiementDette.date_paiement')] },
      include: [{ model: Dette, attributes: [], where: { boutique_id } }],
    });
    const encaisseDettes = paiementsDettes.reduce((a, p) => a + Number(p.montant), 0);
    const toutesDettes = (await Dette.findAll({ where: { boutique_id }, include: [{ model: PaiementDette, as: 'paiements' }] })).map(avecSoldeDette);
    const resteDettes = toutesDettes.filter((d) => !d.soldee).reduce((a, d) => a + d.reste, 0);

    const totalEncaisse = totalVentes + encaisseCommandesSpeciales + encaisseDettes;

    res.json({
      mois,
      boutique: { nom: boutique?.nom, adresse: boutique?.adresse, telephone: boutique?.telephone },
      ventes: { total: totalVentes, nombre: ventes.length, par_moyen_paiement: parMoyen, par_jour: parJour, top_produits: topProduits },
      depenses: { total: totalDepenses, par_categorie: depensesParCategorie },
      achats_fournisseurs: achatsFournisseurs,
      commandes_speciales: { creees: commandesSpecialesCreees, encaisse: encaisseCommandesSpeciales },
      dettes: { encaisse: encaisseDettes, reste_global: resteDettes },
      total_encaisse: totalEncaisse,
      resultat_avant_achats: totalEncaisse - totalDepenses,
      resultat_apres_achats: totalEncaisse - totalDepenses - achatsFournisseurs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
