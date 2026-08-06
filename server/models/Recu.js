const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Recu = sequelize.define('Recu', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vente_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  chemin_pdf: DataTypes.STRING(255),
  qr_code: DataTypes.STRING(255),
}, { tableName: 'recus', updatedAt: false });

module.exports = Recu;
