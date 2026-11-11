const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaiementDette = sequelize.define('PaiementDette', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dette_id: { type: DataTypes.INTEGER, allowNull: false },
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  note: DataTypes.STRING(255),
  date_paiement: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'paiements_dettes', timestamps: false });

module.exports = PaiementDette;
