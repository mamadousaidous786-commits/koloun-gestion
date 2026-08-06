const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vente = sequelize.define('Vente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  utilisateur_id: { type: DataTypes.INTEGER, allowNull: false },
  moyen_paiement_id: { type: DataTypes.INTEGER, allowNull: false },
  numero_recu: { type: DataTypes.STRING(50), unique: true },
  montant_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  observation: DataTypes.STRING(255),
  date_vente: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'ventes', timestamps: false });

module.exports = Vente;
