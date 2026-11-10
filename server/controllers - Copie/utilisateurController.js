const bcrypt = require('bcrypt');
const { Utilisateur, Role, Boutique } = require('../models');

// GET /api/utilisateurs
exports.listerUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await Utilisateur.findAll({
      where: { boutique_id: req.utilisateur.boutique_id },
      include: [{ model: Role }],
      attributes: { exclude: ['mot_de_passe'] },
      order: [['nom', 'ASC']],
    });
    res.json(utilisateurs);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/utilisateurs/:id
exports.modifierUtilisateur = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const donnees = { ...req.body };
    if (donnees.mot_de_passe) {
      donnees.mot_de_passe = await bcrypt.hash(donnees.mot_de_passe, 10);
    } else {
      delete donnees.mot_de_passe;
    }

    await utilisateur.update(donnees);
    res.json({ message: 'Utilisateur mis à jour.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/utilisateurs/:id/statut (activer / désactiver)
exports.changerStatut = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    utilisateur.actif = !utilisateur.actif;
    await utilisateur.save();
    res.json({ message: `Utilisateur ${utilisateur.actif ? 'activé' : 'désactivé'}.` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/utilisateurs/:id
exports.supprimerUtilisateur = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    await utilisateur.destroy();
    res.json({ message: 'Utilisateur supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
