const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MouvementStock = sequelize.define('MouvementStock', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produit_taille_id: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('entree', 'sortie'), allowNull: false },
  quantite: { type: DataTypes.INTEGER, allowNull: false },
  motif: DataTypes.STRING(255),
  utilisateur_id: DataTypes.INTEGER,
}, { tableName: 'mouvements_stock', updatedAt: false });

module.exports = MouvementStock;
