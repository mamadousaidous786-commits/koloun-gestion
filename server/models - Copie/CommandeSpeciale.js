const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Commande spéciale = article commandé pour un client précis (hors stock)
const CommandeSpeciale = sequelize.define('CommandeSpeciale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  client_id: DataTypes.INTEGER,
  client_nom: { type: DataTypes.STRING(150), allowNull: false },
  client_telephone: DataTypes.STRING(50),
  article: { type: DataTypes.STRING(200), allowNull: false },
  details: DataTypes.TEXT,
  image: DataTypes.STRING(255),
  prix_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  date_livraison_prevue: DataTypes.DATEONLY,
  statut: {
    type: DataTypes.ENUM('en_attente', 'commandee', 'arrivee', 'livree', 'annulee'),
    defaultValue: 'en_attente',
  },
  observation: DataTypes.STRING(255),
}, { tableName: 'commandes_speciales' });

module.exports = CommandeSpeciale;
