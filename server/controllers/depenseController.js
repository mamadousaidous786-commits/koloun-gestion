const { Depense, Utilisateur } = require('../models');
const { Op } = require('sequelize');

const CATEGORIES = ['Loyer', 'Transport', 'Électricité / Eau', 'Salaires', 'Marketing', 'Emballage', 'Réparations', 'Autre'];

function bornesDuMois(mois) {
  const m = /^\d{4}-\d{2}$/.test(mois || '') ? mois : new Date().toISOString().slice(0, 7);
  const [annee, numero] = m.split('-').map(Number);
  const dernier = new Date(annee, numero, 0).getDate();
  return { mois: m, debut: `${m}-01`, fin: `${m}-${String(dernier).padStart(2, '0')}` };
}

// GET /api/depenses?mois=YYYY-MM&categorie=
exports.lister = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { mois, debut, fin } = bornesDuMois(req.query.mois);
    const where = { boutique_id, date_depense: { [Op.between]: [debut, fin] } };
    if (req.query.categorie) where.categorie = req.query.categorie;

    const depenses = await Depense.findAll({
      where,
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'prenom'] }],
      order: [['date_depense', 'DESC'], ['id', 'DESC']],
    });

    const parCategorie = {};
    let total = 0;
    depenses.forEach((d) => {
      const m = Number(d.montant);
      total += m;
      parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + m;
    });

    res.json({ mois, depenses, total, par_categorie: parCategorie, categories: CATEGORIES });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/depenses
exports.creer = async (req, res) => {
  try {
    const { categorie, description, date_depense } = req.body;
    const montant = Number(req.body.montant);
    if (!categorie) return res.status(400).json({ message: 'Choisissez une catégorie.' });
    if (!(montant > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });

    const depense = await Depense.create({
      boutique_id: req.utilisateur.boutique_id,
      utilisateur_id: req.utilisateur.id,
      categorie,
      description,
      montant,
      date_depense: date_depense || new Date().toISOString().slice(0, 10),
    });
    res.status(201).json(depense);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/depenses/:id
exports.supprimer = async (req, res) => {
  try {
    const depense = await Depense.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!depense) return res.status(404).json({ message: 'Dépense introuvable.' });
    await depense.destroy();
    res.json({ message: 'Dépense supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

exports.bornesDuMois = bornesDuMois;
