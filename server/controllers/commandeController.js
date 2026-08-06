const { Commande, Fournisseur, Notification } = require('../models');
const { Op } = require('sequelize');

// GET /api/commandes?periode=jour|mois&date=YYYY-MM-DD
exports.listerCommandes = async (req, res) => {
  try {
    const { periode, date } = req.query;
    const filtre = { boutique_id: req.utilisateur.boutique_id };

    if (periode && date) {
      const jourReference = new Date(date);
      if (periode === 'jour') {
        filtre.date_commande = date;
      } else if (periode === 'mois') {
        const debutMois = new Date(jourReference.getFullYear(), jourReference.getMonth(), 1);
        const finMois = new Date(jourReference.getFullYear(), jourReference.getMonth() + 1, 0);
        filtre.date_commande = {
          [Op.between]: [debutMois.toISOString().slice(0, 10), finMois.toISOString().slice(0, 10)],
        };
      }
    }

    const commandes = await Commande.findAll({
      where: filtre,
      include: [{ model: Fournisseur }],
      order: [['date_commande', 'DESC']],
    });
    res.json(commandes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/commandes
exports.creerCommande = async (req, res) => {
  try {
    const { fournisseur_id, nom_commande, montant_total, quantite_totale, transport, date_commande } = req.body;

    const commande = await Commande.create({
      boutique_id: req.utilisateur.boutique_id,
      fournisseur_id,
      nom_commande,
      montant_total,
      quantite_totale,
      transport: transport || 0,
      date_commande,
    });

    // Recharge pour obtenir les champs calculés (prix_unitaire, cout_reel, objectif...)
    await commande.reload({ include: [{ model: Fournisseur }] });

    res.status(201).json(commande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes/:id/transport -- Définir/mettre à jour le transport une fois le produit arrivé
exports.mettreAJourTransport = async (req, res) => {
  try {
    const { transport } = req.body;
    const commande = await Commande.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    commande.transport = transport;
    await commande.save();
    await commande.reload({ include: [{ model: Fournisseur }] });

    res.json(commande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes/:id/montant-realise -- Met à jour le montant réalisé par les ventes et vérifie l'objectif
exports.mettreAJourRentabilite = async (req, res) => {
  try {
    const { montant_realise } = req.body;
    const commande = await Commande.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    commande.montant_realise = montant_realise;
    await commande.reload();

    if (Number(montant_realise) >= Number(commande.objectif) && commande.statut !== 'amortie') {
      commande.statut = 'amortie';
      await Notification.create({
        boutique_id: req.utilisateur.boutique_id,
        type: 'objectif_atteint',
        message: `Objectif de rentabilité atteint pour la commande "${commande.nom_commande || commande.id}".`,
      });
    }

    await commande.save();
    res.json(commande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/commandes/:id
exports.supprimerCommande = async (req, res) => {
  try {
    const commande = await Commande.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    await commande.destroy();
    res.json({ message: 'Commande supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
