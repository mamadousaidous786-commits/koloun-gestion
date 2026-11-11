const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Depense = sequelize.define('Depense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  utilisateur_id: DataTypes.INTEGER,
  categorie: { type: DataTypes.STRING(80), allowNull: false },
  description: DataTypes.STRING(255),
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  date_depense: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'depenses', updatedAt: false });

module.exports = Depense;
