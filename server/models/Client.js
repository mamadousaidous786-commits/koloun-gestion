const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  telephone: DataTypes.STRING(50),
  adresse: DataTypes.STRING(255),
  notes: DataTypes.TEXT,
}, { tableName: 'clients', updatedAt: false });

module.exports = Client;
