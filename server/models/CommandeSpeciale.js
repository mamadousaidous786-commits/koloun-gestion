const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Commande spéciale = article commandé pour un client précis (hors stock)
const CommandeSpeciale = sequelize.define('CommandeSpeciale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  boutique_id: { type: DataTypes.INTEGER, allowNull: false },
  client_id: DataTypes.INTEGER,
  client_nom: { type: DataTypes.STRING(150), allowNull: false },
  client_telephone: DataTypes.STRING(50),
  article: { type: DataTypes.STRING(200), allowNull: false },
  details: DataTypes.TEXT,
  image: DataTypes.STRING(255), // 1re photo (aperçu, suivi, reçu)
  // Toutes les photos de la commande : [{ nom, taille, image }] (nom et taille facultatifs)
  articles: {
    type: DataTypes.TEXT,
    get() {
      const brut = this.getDataValue('articles');
      if (!brut) return [];
      try { const v = JSON.parse(brut); return Array.isArray(v) ? v : []; } catch { return []; }
    },
    set(v) { this.setDataValue('articles', v && v.length ? JSON.stringify(v) : null); },
  },
  prix_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  date_livraison_prevue: DataTypes.DATEONLY,
  statut: {
    type: DataTypes.ENUM('en_attente', 'commandee', 'entrepot', 'en_transit', 'arrivee', 'livree', 'annulee'),
    defaultValue: 'en_attente',
  },
  observation: DataTypes.STRING(255),
  code_suivi: DataTypes.STRING(20), // lien public de suivi envoyé au client
}, { tableName: 'commandes_speciales' });

module.exports = CommandeSpeciale;
