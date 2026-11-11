const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Fournisseur = sequelize.define('Fournisseur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  telephone: DataTypes.STRING(50),
  adresse: DataTypes.STRING(255),
}, { tableName: 'fournisseurs', updatedAt: false });

module.exports = Fournisseur;
