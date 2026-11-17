const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Un article d'une livraison (une livraison peut en contenir plusieurs, chacun avec sa photo et sa taille)
const LivraisonArticle = sequelize.define('LivraisonArticle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  livraison_id: { type: DataTypes.INTEGER, allowNull: false },
  designation: { type: DataTypes.STRING(200), allowNull: false },
  taille: DataTypes.STRING(30),
  image: DataTypes.STRING(500),
}, { tableName: 'livraison_articles', timestamps: false });

module.exports = LivraisonArticle;
