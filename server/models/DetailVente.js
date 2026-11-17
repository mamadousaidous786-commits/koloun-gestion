const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DetailVente = sequelize.define('DetailVente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vente_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_taille_id: DataTypes.INTEGER, // devient NULL si le produit est supprimé : l'historique reste grâce aux champs ci-dessous
  produit_nom: DataTypes.STRING(200),
  taille_nom: DataTypes.STRING(50),
  prix_normal: DataTypes.DECIMAL(12, 2),
  quantite: { type: DataTypes.INTEGER, allowNull: false },
  prix_applique: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  sous_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
}, { tableName: 'details_ventes', timestamps: false });

module.exports = DetailVente;
