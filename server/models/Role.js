const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  description: DataTypes.STRING(255),
}, { tableName: 'roles', timestamps: false });

module.exports = Role;
