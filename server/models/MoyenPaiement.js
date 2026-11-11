const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MoyenPaiement = sequelize.define('MoyenPaiement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(50), allowNull: false, unique: true },
}, { tableName: 'moyens_paiement', timestamps: false });

module.exports = MoyenPaiement;
