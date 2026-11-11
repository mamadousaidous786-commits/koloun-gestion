const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Groupe de commande : plusieurs commandes passées séparément le même jour, arrivées ensemble.
// Le transport est saisi UNE fois pour le groupe puis réparti sur toutes les pièces.
const GroupeCommande = sequelize.define('GroupeCommande', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  date_commande: { type: DataTypes.DATEONLY, allowNull: false },
  transport: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  transport_valide: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'groupes_commande', updatedAt: false });

module.exports = GroupeCommande;
