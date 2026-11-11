const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProduitTaille = sequelize.define('ProduitTaille', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produit_variante_id: { type: DataTypes.INTEGER, allowNull: false },
  taille: { type: DataTypes.STRING(50), allowNull: false },
  quantite: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  seuil_alerte: { type: DataTypes.INTEGER, defaultValue: 3 },
}, { tableName: 'produit_tailles' });

module.exports = ProduitTaille;
