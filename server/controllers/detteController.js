const { Dette, PaiementDette } = require('../models');
const { Op } = require('sequelize');
const { avecSoldeDette } = require('../utils/soldes');
const { trouverOuCreerClient } = require('../utils/clients');

const INCLUS = [{ model: PaiementDette, as: 'paiements' }];
const nombre = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));

async function charger(id, boutique_id) {
  return Dette.findOne({ where: { id, boutique_id }, include: INCLUS });
}

// GET /api/dettes?statut=en_cours|soldee|toutes&q=&tri=reste|date
exports.lister = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { statut = 'en_cours', tri = 'reste' } = req.query;
    const q = (req.query.q || '').trim();

    const where = { boutique_id };
    if (q) where[Op.or] = [{ personne_nom: { [Op.like]: `%${q}%` } }, { telephone: { [Op.like]: `%${q}%` } }];

    const toutes = (await Dette.findAll({ where, include: INCLUS, order: [['date_dette', 'DESC']] })).map(avecSoldeDette);

    let dettes = toutes;
    if (statut === 'en_cours') dettes = toutes.filter((d) => !d.soldee);
    else if (statut === 'soldee') dettes = toutes.filter((d) => d.soldee);

    dettes.sort(tri === 'date'
      ? (a, b) => String(a.date_dette).localeCompare(String(b.date_dette))   // les plus anciennes d'abord
      : (a, b) => b.reste - a.reste);                                         // les plus grosses d'abord

    const enCours = toutes.filter((d) => !d.soldee);
    res.json({
      dettes,
      resume: {
        total_restant: enCours.reduce((a, d) => a + d.reste, 0),
        nombre_en_cours: enCours.length,
        nombre_en_retard: enCours.filter((d) => d.en_retard).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/dettes
exports.creer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { client_id, personne_nom, telephone, motif, date_dette, date_echeance, observation } = req.body;
    const montant_initial = nombre(req.body.montant_initial);

    if (!(montant_initial > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });
    const client = await trouverOuCreerClient(boutique_id, { client_id, nom: personne_nom, telephone });
    if (!client) return res.status(400).json({ message: 'Indiquez le nom de la personne.' });

    const dette = await Dette.create({
      boutique_id,
      client_id: client.id,
      personne_nom: client.nom,
      telephone: telephone || client.telephone || null,
      motif,
      montant_initial,
      date_dette: date_dette || new Date().toISOString().slice(0, 10),
      date_echeance: date_echeance || null,
      observation,
    });
    res.status(201).json(avecSoldeDette(await charger(dette.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/dettes/:id
exports.modifier = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const dette = await charger(req.params.id, boutique_id);
    if (!dette) return res.status(404).json({ message: 'Dette introuvable.' });

    const champs = {};
    ['personne_nom', 'telephone', 'motif', 'date_echeance', 'observation'].forEach((k) => {
      if (req.body[k] !== undefined) champs[k] = req.body[k] === '' ? null : req.body[k];
    });
    if (req.body.montant_initial !== undefined) {
      const montant = nombre(req.body.montant_initial);
      if (!(montant > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });
      champs.montant_initial = montant;
    }
    await dette.update(champs);
    res.json(avecSoldeDette(await charger(dette.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/dettes/:id/paiements
exports.ajouterPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const dette = await charger(req.params.id, boutique_id);
    if (!dette) return res.status(404).json({ message: 'Dette introuvable.' });

    const montant = nombre(req.body.montant);
    if (!(montant > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });
    const { reste } = avecSoldeDette(dette);
    if (montant > reste) return res.status(400).json({ message: `Le montant dépasse le reste dû (${reste.toLocaleString('fr-FR')} GNF).` });

    await PaiementDette.create({ dette_id: dette.id, montant, note: req.body.note || null });
    res.status(201).json(avecSoldeDette(await charger(dette.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/dettes/:id/paiements/:paiementId
exports.supprimerPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const dette = await charger(req.params.id, boutique_id);
    if (!dette) return res.status(404).json({ message: 'Dette introuvable.' });
    const paiement = await PaiementDette.findOne({ where: { id: req.params.paiementId, dette_id: dette.id } });
    if (!paiement) return res.status(404).json({ message: 'Paiement introuvable.' });
    await paiement.destroy();
    res.json(avecSoldeDette(await charger(dette.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/dettes/:id
exports.supprimer = async (req, res) => {
  try {
    const dette = await Dette.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!dette) return res.status(404).json({ message: 'Dette introuvable.' });
    await dette.destroy();
    res.json({ message: 'Dette supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
