const { Client, Vente, MoyenPaiement, CommandeSpeciale, PaiementCommandeSpeciale, Dette, PaiementDette } = require('../models');
const { Op } = require('sequelize');
const { avecSoldeCommande, avecSoldeDette } = require('../utils/soldes');

// GET /api/clients?q=
exports.lister = async (req, res) => {
  try {
    const where = { boutique_id: req.utilisateur.boutique_id };
    const q = (req.query.q || '').trim();
    if (q) where[Op.or] = [{ nom: { [Op.like]: `%${q}%` } }, { telephone: { [Op.like]: `%${q}%` } }];
    const clients = await Client.findAll({ where, order: [['nom', 'ASC']] });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/clients/:id  -- fiche complète : achats, commandes spéciales, dettes
exports.obtenir = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const client = await Client.findOne({ where: { id: req.params.id, boutique_id } });
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });

    const ventes = await Vente.findAll({
      where: { client_id: client.id, boutique_id },
      include: [{ model: MoyenPaiement }],
      order: [['date_vente', 'DESC']],
      limit: 50,
    });
    const totalAchats = await Vente.sum('montant_total', { where: { client_id: client.id, boutique_id } }) || 0;
    const nombreAchats = await Vente.count({ where: { client_id: client.id, boutique_id } });

    const commandes = (await CommandeSpeciale.findAll({
      where: { client_id: client.id, boutique_id },
      include: [{ model: PaiementCommandeSpeciale, as: 'paiements' }],
      order: [['created_at', 'DESC']],
    })).map(avecSoldeCommande);

    const dettes = (await Dette.findAll({
      where: { client_id: client.id, boutique_id },
      include: [{ model: PaiementDette, as: 'paiements' }],
      order: [['date_dette', 'DESC']],
    })).map(avecSoldeDette);

    res.json({
      client,
      ventes,
      total_achats: Number(totalAchats),
      nombre_achats: nombreAchats,
      commandes_speciales: commandes,
      dettes,
      reste_commandes: commandes.filter((c) => c.statut !== 'annulee').reduce((a, c) => a + c.reste, 0),
      reste_dettes: dettes.reduce((a, d) => a + d.reste, 0),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/clients
exports.creer = async (req, res) => {
  try {
    const { nom, telephone, adresse, notes } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });
    const client = await Client.create({
      boutique_id: req.utilisateur.boutique_id,
      nom: nom.trim(), telephone, adresse, notes,
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/clients/:id
exports.modifier = async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });
    const { nom, telephone, adresse, notes } = req.body;
    if (nom !== undefined && !String(nom).trim()) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });
    await client.update({ nom: nom !== undefined ? String(nom).trim() : client.nom, telephone, adresse, notes });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/clients/:id  (l'historique reste, simplement détaché du client)
exports.supprimer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const client = await Client.findOne({ where: { id: req.params.id, boutique_id } });
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });
    await Vente.update({ client_id: null }, { where: { client_id: client.id, boutique_id } });
    await CommandeSpeciale.update({ client_id: null }, { where: { client_id: client.id, boutique_id } });
    await Dette.update({ client_id: null }, { where: { client_id: client.id, boutique_id } });
    await client.destroy();
    res.json({ message: 'Client supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
