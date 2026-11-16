const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Historique du suivi d'une commande spéciale (chaque changement d'étape)
const SuiviCommandeSpeciale = sequelize.define('SuiviCommandeSpeciale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  commande_speciale_id: { type: DataTypes.INTEGER, allowNull: false },
  statut: { type: DataTypes.STRING(30), allowNull: false },
  note: DataTypes.STRING(255),
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'suivi_commandes_speciales', timestamps: false });

module.exports = SuiviCommandeSpeciale;
