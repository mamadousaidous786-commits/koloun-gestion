const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Utilisateur = sequelize.define('Utilisateur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  prenom: DataTypes.STRING(100),
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  telephone: DataTypes.STRING(50),
  mot_de_passe: { type: DataTypes.STRING(255), allowNull: false },
  actif: { type: DataTypes.BOOLEAN, defaultValue: true },
  derniere_connexion: DataTypes.DATE,
}, { tableName: 'utilisateurs' });

module.exports = Utilisateur;
