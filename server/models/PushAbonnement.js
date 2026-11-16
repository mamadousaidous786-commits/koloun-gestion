const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Un téléphone / ordinateur qui a accepté de recevoir les alertes (notifications push)
const PushAbonnement = sequelize.define('PushAbonnement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  utilisateur_id: DataTypes.INTEGER,
  role: DataTypes.STRING(30),
  endpoint_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  endpoint: { type: DataTypes.TEXT, allowNull: false },
  p256dh: { type: DataTypes.STRING(255), allowNull: false },
  auth: { type: DataTypes.STRING(255), allowNull: false },
}, { tableName: 'push_abonnements', updatedAt: false });

module.exports = PushAbonnement;
