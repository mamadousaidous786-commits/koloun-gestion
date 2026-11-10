const { CommandeSpeciale, PaiementCommandeSpeciale, MoyenPaiement, Notification } = require('../models');
const { Op } = require('sequelize');
const { avecSoldeCommande } = require('../utils/soldes');
const { trouverOuCreerClient } = require('../utils/clients');

const STATUTS = ['en_attente', 'commandee', 'arrivee', 'livree', 'annulee'];
const INCLUS = [{ model: PaiementCommandeSpeciale, as: 'paiements', include: [{ model: MoyenPaiement }] }];

const nombre = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));

async function charger(id, boutique_id) {
  return CommandeSpeciale.findOne({ where: { id, boutique_id }, include: INCLUS });
}

// GET /api/commandes-speciales?statut=&q=
exports.lister = async (req, res) => {
  try {
    const where = { boutique_id: req.utilisateur.boutique_id };
    if (req.query.statut && STATUTS.includes(req.query.statut)) where.statut = req.query.statut;
    const q = (req.query.q || '').trim();
    if (q) where[Op.or] = [{ client_nom: { [Op.like]: `%${q}%` } }, { article: { [Op.like]: `%${q}%` } }];

    const commandes = await CommandeSpeciale.findAll({ where, include: INCLUS, order: [['created_at', 'DESC']] });
    res.json(commandes.map(avecSoldeCommande));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/commandes-speciales  (multipart : photo facultative ; acompte facultatif)
exports.creer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { client_id, client_nom, client_telephone, article, details, date_livraison_prevue, observation, moyen_paiement_id } = req.body;
    const prix_total = nombre(req.body.prix_total);
    const acompte = nombre(req.body.acompte); // facultatif : 0 si non renseigné

    if (!article || !article.trim()) return res.status(400).json({ message: "L'article demandé est obligatoire." });
    if (!(prix_total > 0)) return res.status(400).json({ message: 'Le prix total doit être supérieur à 0.' });
    if (acompte < 0) return res.status(400).json({ message: "L'avance ne peut pas être négative." });
    if (acompte > prix_total) return res.status(400).json({ message: "L'avance ne peut pas dépasser le prix total." });

    const client = await trouverOuCreerClient(boutique_id, { client_id, nom: client_nom, telephone: client_telephone });
    if (!client) return res.status(400).json({ message: 'Indiquez le nom du client.' });

    const commande = await CommandeSpeciale.create({
      boutique_id,
      client_id: client.id,
      client_nom: client.nom,
      client_telephone: client_telephone || client.telephone || null,
      article: article.trim(),
      details,
      image: req.file ? req.file.path : null,
      prix_total,
      date_livraison_prevue: date_livraison_prevue || null,
      observation,
    });

    if (acompte > 0) {
      await PaiementCommandeSpeciale.create({
        commande_speciale_id: commande.id,
        montant: acompte,
        moyen_paiement_id: moyen_paiement_id || 3,
        note: 'Avance à la commande',
      });
    }

    res.status(201).json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes-speciales/:id
exports.modifier = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const champs = {};
    ['client_nom', 'client_telephone', 'article', 'details', 'date_livraison_prevue', 'observation'].forEach((k) => {
      if (req.body[k] !== undefined) champs[k] = req.body[k] === '' ? null : req.body[k];
    });
    if (req.body.prix_total !== undefined) {
      const prix = nombre(req.body.prix_total);
      if (!(prix > 0)) return res.status(400).json({ message: 'Le prix total doit être supérieur à 0.' });
      champs.prix_total = prix;
    }
    if (req.file) champs.image = req.file.path;
    await commande.update(champs);

    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes-speciales/:id/statut
exports.changerStatut = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { statut } = req.body;
    if (!STATUTS.includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });

    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const ancien = commande.statut;
    await commande.update({ statut });

    if (statut === 'arrivee' && ancien !== 'arrivee') {
      await Notification.create({
        boutique_id,
        type: 'commande_speciale_arrivee',
        message: `La commande spéciale de ${commande.client_nom} (${commande.article}) est arrivée.`,
      });
    }

    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/commandes-speciales/:id/paiements
exports.ajouterPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const montant = nombre(req.body.montant);
    if (!(montant > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });

    const { reste } = avecSoldeCommande(commande);
    if (montant > reste) return res.status(400).json({ message: `Le montant dépasse le reste à payer (${reste.toLocaleString('fr-FR')} GNF).` });

    await PaiementCommandeSpeciale.create({
      commande_speciale_id: commande.id,
      montant,
      moyen_paiement_id: req.body.moyen_paiement_id || 3,
      note: req.body.note || null,
    });

    res.status(201).json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/commandes-speciales/:id/paiements/:paiementId  (admin)
exports.supprimerPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    const paiement = await PaiementCommandeSpeciale.findOne({ where: { id: req.params.paiementId, commande_speciale_id: commande.id } });
    if (!paiement) return res.status(404).json({ message: 'Paiement introuvable.' });
    await paiement.destroy();
    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/commandes-speciales/:id  (admin)
exports.supprimer = async (req, res) => {
  try {
    const commande = await CommandeSpeciale.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    await commande.destroy();
    res.json({ message: 'Commande supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
