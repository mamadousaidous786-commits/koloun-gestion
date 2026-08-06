const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Utilisateur, Role, Boutique, Historique } = require('../models');
require('dotenv').config();

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    const utilisateur = await Utilisateur.findOne({
      where: { email },
      include: [{ model: Role }, { model: Boutique }],
    });

    if (!utilisateur) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    if (!utilisateur.actif) {
      return res.status(403).json({ message: 'Ce compte a été désactivé.' });
    }

    const motDePasseValide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!motDePasseValide) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      {
        id: utilisateur.id,
        role: utilisateur.Role.nom,
        boutique_id: utilisateur.boutique_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    utilisateur.derniere_connexion = new Date();
    await utilisateur.save();

    await Historique.create({
      utilisateur_id: utilisateur.id,
      boutique_id: utilisateur.boutique_id,
      action: 'Connexion',
      details: `Connexion réussie de ${utilisateur.email}`,
    });

    res.json({
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.Role.nom,
        boutique: utilisateur.Boutique.nom,
        boutique_id: utilisateur.boutique_id,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/auth/register (réservé à l'admin - création d'utilisateurs)
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, mot_de_passe, role_id } = req.body;
    // La boutique est celle de l'administrateur connecté, sauf si explicitement fournie (multi-boutiques)
    const boutique_id = req.body.boutique_id || req.utilisateur.boutique_id;

    const utilisateurExistant = await Utilisateur.findOne({ where: { email } });
    if (utilisateurExistant) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const motDePasseHache = await bcrypt.hash(mot_de_passe, 10);

    const nouvelUtilisateur = await Utilisateur.create({
      nom,
      prenom,
      email,
      telephone,
      mot_de_passe: motDePasseHache,
      role_id,
      boutique_id,
    });

    res.status(201).json({ message: 'Utilisateur créé avec succès.', id: nouvelUtilisateur.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/auth/me
exports.profil = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id, {
      include: [{ model: Role }, { model: Boutique }],
      attributes: { exclude: ['mot_de_passe'] },
    });
    res.json(utilisateur);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
