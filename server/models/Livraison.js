const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Livraison à effectuer (commandes du jour à livrer) : visible par tous les utilisateurs
const Livraison = sequelize.define('Livraison', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  date_livraison: { type: DataTypes.DATEONLY, allowNull: false },
  client_nom: { type: DataTypes.STRING(150), allowNull: false },
  client_telephone: DataTypes.STRING(50),
  adresse: DataTypes.STRING(255),
  article: { type: DataTypes.STRING(200), allowNull: false },
  taille: DataTypes.STRING(30),
  image: DataTypes.STRING(500),
  montant_livraison: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // frais de livraison
  montant_a_encaisser: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // à récupérer auprès du client
  livreur: DataTypes.STRING(100),
  note: DataTypes.STRING(255),
  statut: { type: DataTypes.ENUM('en_cours', 'livree', 'annulee'), defaultValue: 'en_cours' },
  motif: DataTypes.STRING(255), // raison d'annulation
  cree_par: DataTypes.INTEGER,
  valide_par: DataTypes.INTEGER,
  date_validation: DataTypes.DATE,
}, { tableName: 'livraisons', updatedAt: false });

module.exports = Livraison;
