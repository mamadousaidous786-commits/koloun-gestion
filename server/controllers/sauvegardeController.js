const {
  Boutique, Utilisateur, Fournisseur, Produit, ProduitVariante, ProduitTaille, MouvementStock, Commande,
  Vente, DetailVente, Client, CommandeSpeciale, PaiementCommandeSpeciale, Dette, PaiementDette, Depense,
  ClotureCaisse, Notification,
} = require('../models');

// GET /api/sauvegarde/export  -- télécharge toutes les données de la boutique (JSON)
exports.exporter = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const par = { where: { boutique_id } };

    const ventes = await Vente.findAll({ ...par, include: [{ model: DetailVente }] });
    const donnees = {
      application: 'Koloun Luxure — Gestion commerciale',
      exporte_le: new Date().toISOString(),
      boutique: await Boutique.findByPk(boutique_id),
      utilisateurs: await Utilisateur.findAll({ ...par, attributes: { exclude: ['mot_de_passe'] } }),
      fournisseurs: await Fournisseur.findAll(par),
      produits: await Produit.findAll({ ...par, include: [{ model: ProduitVariante, include: [ProduitTaille] }] }),
      mouvements_stock: await MouvementStock.findAll(),
      commandes_fournisseurs: await Commande.findAll(par),
      ventes,
      clients: await Client.findAll(par),
      commandes_speciales: await CommandeSpeciale.findAll({ ...par, include: [{ model: PaiementCommandeSpeciale, as: 'paiements' }] }),
      dettes: await Dette.findAll({ ...par, include: [{ model: PaiementDette, as: 'paiements' }] }),
      depenses: await Depense.findAll(par),
      clotures_caisse: await ClotureCaisse.findAll(par),
      notifications: await Notification.findAll(par),
    };

    const nomFichier = `sauvegarde-koloun-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    res.send(JSON.stringify(donnees, null, 2));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
