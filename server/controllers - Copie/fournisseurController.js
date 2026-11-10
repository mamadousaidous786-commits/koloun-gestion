const { Fournisseur } = require('../models');

exports.lister = async (req, res) => {
  try {
    const fournisseurs = await Fournisseur.findAll({ where: { boutique_id: req.utilisateur.boutique_id } });
    res.json(fournisseurs);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

exports.creer = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.create({ ...req.body, boutique_id: req.utilisateur.boutique_id });
    res.status(201).json(fournisseur);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

exports.modifier = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!fournisseur) return res.status(404).json({ message: 'Introuvable.' });
    await fournisseur.update(req.body);
    res.json(fournisseur);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

exports.supprimer = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!fournisseur) return res.status(404).json({ message: 'Introuvable.' });
    await fournisseur.destroy();
    res.json({ message: 'Supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
