const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Dette = somme qu'une personne doit à la boutique
const Dette = sequelize.define('Dette', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  client_id: DataTypes.INTEGER,
  personne_nom: { type: DataTypes.STRING(150), allowNull: false },
  telephone: DataTypes.STRING(50),
  motif: DataTypes.STRING(255),
  montant_initial: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  date_dette: { type: DataTypes.DATEONLY, allowNull: false },
  date_echeance: DataTypes.DATEONLY,
  observation: DataTypes.STRING(255),
}, { tableName: 'dettes', updatedAt: false });

module.exports = Dette;
