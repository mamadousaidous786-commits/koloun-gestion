const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  utilisateur_id: DataTypes.INTEGER,
  type: { type: DataTypes.STRING(50), allowNull: false },
  message: { type: DataTypes.STRING(255), allowNull: false },
  lue: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'notifications', updatedAt: false });

module.exports = Notification;
