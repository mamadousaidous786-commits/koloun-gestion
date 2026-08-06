const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProduitVariante = sequelize.define('ProduitVariante', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  image: { type: DataTypes.STRING(255), allowNull: false },
  description: DataTypes.STRING(255),
}, { tableName: 'produit_variantes', updatedAt: false });

module.exports = ProduitVariante;
