const jwt = require('jsonwebtoken');
require('dotenv').config();

// Vérifie que le token JWT est présent et valide
function verifierToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Token manquant.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide ou expiré.' });
    }
    req.utilisateur = decoded; // { id, role, boutique_id }
    next();
  });
}

// Vérifie que l'utilisateur possède l'un des rôles autorisés
function autoriserRoles(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.utilisateur || !rolesAutorises.includes(req.utilisateur.role)) {
      return res.status(403).json({ message: 'Accès interdit : droits insuffisants.' });
    }
    next();
  };
}

module.exports = { verifierToken, autoriserRoles };
