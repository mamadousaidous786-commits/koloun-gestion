const sequelize = require('../config/database');

const Boutique = require('./Boutique');
const Role = require('./Role');
const Utilisateur = require('./Utilisateur');
const Fournisseur = require('./Fournisseur');
const Produit = require('./Produit');
const ProduitVariante = require('./ProduitVariante');
const ProduitTaille = require('./ProduitTaille');
const MouvementStock = require('./MouvementStock');
const MoyenPaiement = require('./MoyenPaiement');
const Commande = require('./Commande');
const Vente = require('./Vente');
const DetailVente = require('./DetailVente');
const Recu = require('./Recu');
const Paiement = require('./Paiement');
const Notification = require('./Notification');
const Historique = require('./Historique');

// ---- Boutique ----
Boutique.hasMany(Utilisateur, { foreignKey: 'boutique_id' });
Utilisateur.belongsTo(Boutique, { foreignKey: 'boutique_id' });

Boutique.hasMany(Fournisseur, { foreignKey: 'boutique_id' });
Fournisseur.belongsTo(Boutique, { foreignKey: 'boutique_id' });

Boutique.hasMany(Produit, { foreignKey: 'boutique_id' });
Produit.belongsTo(Boutique, { foreignKey: 'boutique_id' });

Boutique.hasMany(Commande, { foreignKey: 'boutique_id' });
Commande.belongsTo(Boutique, { foreignKey: 'boutique_id' });

Boutique.hasMany(Vente, { foreignKey: 'boutique_id' });
Vente.belongsTo(Boutique, { foreignKey: 'boutique_id' });

Boutique.hasMany(Notification, { foreignKey: 'boutique_id' });
Notification.belongsTo(Boutique, { foreignKey: 'boutique_id' });

// ---- Role / Utilisateur ----
Role.hasMany(Utilisateur, { foreignKey: 'role_id' });
Utilisateur.belongsTo(Role, { foreignKey: 'role_id' });

// ---- Produit / Variantes (photo) / Tailles ----
Produit.hasMany(ProduitVariante, { foreignKey: 'produit_id', onDelete: 'CASCADE' });
ProduitVariante.belongsTo(Produit, { foreignKey: 'produit_id' });

ProduitVariante.hasMany(ProduitTaille, { foreignKey: 'produit_variante_id', onDelete: 'CASCADE' });
ProduitTaille.belongsTo(ProduitVariante, { foreignKey: 'produit_variante_id' });

ProduitTaille.hasMany(MouvementStock, { foreignKey: 'produit_taille_id' });
MouvementStock.belongsTo(ProduitTaille, { foreignKey: 'produit_taille_id' });

Utilisateur.hasMany(MouvementStock, { foreignKey: 'utilisateur_id' });
MouvementStock.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id' });

// ---- Commandes fournisseurs ----
Fournisseur.hasMany(Commande, { foreignKey: 'fournisseur_id' });
Commande.belongsTo(Fournisseur, { foreignKey: 'fournisseur_id' });

// ---- Ventes ----
Utilisateur.hasMany(Vente, { foreignKey: 'utilisateur_id' });
Vente.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id' });

MoyenPaiement.hasMany(Vente, { foreignKey: 'moyen_paiement_id' });
Vente.belongsTo(MoyenPaiement, { foreignKey: 'moyen_paiement_id' });

Vente.hasMany(DetailVente, { foreignKey: 'vente_id', onDelete: 'CASCADE' });
DetailVente.belongsTo(Vente, { foreignKey: 'vente_id' });

ProduitTaille.hasMany(DetailVente, { foreignKey: 'produit_taille_id' });
DetailVente.belongsTo(ProduitTaille, { foreignKey: 'produit_taille_id' });

Vente.hasOne(Recu, { foreignKey: 'vente_id' });
Recu.belongsTo(Vente, { foreignKey: 'vente_id' });

Vente.hasMany(Paiement, { foreignKey: 'vente_id' });
Paiement.belongsTo(Vente, { foreignKey: 'vente_id' });

MoyenPaiement.hasMany(Paiement, { foreignKey: 'moyen_paiement_id' });
Paiement.belongsTo(MoyenPaiement, { foreignKey: 'moyen_paiement_id' });

// ---- Notifications / Historique ----
Utilisateur.hasMany(Notification, { foreignKey: 'utilisateur_id' });
Notification.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id' });

Utilisateur.hasMany(Historique, { foreignKey: 'utilisateur_id' });
Historique.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id' });

module.exports = {
  sequelize,
  Boutique,
  Role,
  Utilisateur,
  Fournisseur,
  Produit,
  ProduitVariante,
  ProduitTaille,
  MouvementStock,
  MoyenPaiement,
  Commande,
  Vente,
  DetailVente,
  Recu,
  Paiement,
  Notification,
  Historique,
};
