const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Historique = sequelize.define('Historique', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilisateur_id: DataTypes.INTEGER,
  boutique_id: DataTypes.INTEGER,
  action: { type: DataTypes.STRING(150), allowNull: false },
  details: DataTypes.TEXT,
}, { tableName: 'historiques', updatedAt: false });

module.exports = Historique;
