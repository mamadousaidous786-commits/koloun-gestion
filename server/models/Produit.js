const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produit = sequelize.define('Produit', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  prix_normal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  description: DataTypes.TEXT,
}, { tableName: 'produits' });

module.exports = Produit;
