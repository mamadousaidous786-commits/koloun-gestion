const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClotureCaisse = sequelize.define('ClotureCaisse', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  utilisateur_id: DataTypes.INTEGER,
  date_cloture: { type: DataTypes.DATEONLY, allowNull: false },
  attendu_cash: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  attendu_om: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  attendu_pm: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  compte_cash: DataTypes.DECIMAL(12, 2),
  compte_om: DataTypes.DECIMAL(12, 2),
  compte_pm: DataTypes.DECIMAL(12, 2),
  ecart_cash: DataTypes.DECIMAL(12, 2),
  ecart_om: DataTypes.DECIMAL(12, 2),
  ecart_pm: DataTypes.DECIMAL(12, 2),
  note: DataTypes.STRING(255),
}, { tableName: 'clotures_caisse', updatedAt: false });

module.exports = ClotureCaisse;
