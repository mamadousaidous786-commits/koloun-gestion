const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Boutique = sequelize.define('Boutique', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  adresse: DataTypes.STRING(255),
  telephone: DataTypes.STRING(50),
  logo: DataTypes.STRING(255),
}, { tableName: 'boutiques' });

module.exports = Boutique;
