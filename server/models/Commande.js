const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Commande = sequelize.define('Commande', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  fournisseur_id: { type: DataTypes.INTEGER, allowNull: false },
  nom_commande: DataTypes.STRING(150),
  montant_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  quantite_totale: { type: DataTypes.INTEGER, allowNull: false },
  transport: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // Colonnes calculées automatiquement par MySQL (GENERATED ALWAYS). On les déclare en lecture
  // seule ici (jamais transmises dans un create/update) pour que Sequelize les lise correctement.
  prix_unitaire: { type: DataTypes.DECIMAL(12, 2) },
  transport_unitaire: { type: DataTypes.DECIMAL(12, 2) },
  cout_reel: { type: DataTypes.DECIMAL(12, 2) },
  objectif: { type: DataTypes.DECIMAL(12, 2) },
  montant_realise: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  statut: { type: DataTypes.ENUM('en_cours', 'amortie', 'annulee'), defaultValue: 'en_cours' },
  date_commande: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'commandes', updatedAt: false });

module.exports = Commande;
