const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaiementCommandeSpeciale = sequelize.define('PaiementCommandeSpeciale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  commande_speciale_id: { type: DataTypes.INTEGER, allowNull: false },
  montant: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  moyen_paiement_id: DataTypes.INTEGER,
  note: DataTypes.STRING(255),
  date_paiement: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'paiements_commandes_speciales', timestamps: false });

module.exports = PaiementCommandeSpeciale;
