const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Paiement = sequelize.define('Paiement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vente_id: { type: DataTypes.INTEGER, allowNull: false },
  moyen_paiement_id: { type: DataTypes.INTEGER, allowNull: false },
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  date_paiement: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'paiements', timestamps: false });

module.exports = Paiement;
