const path = require('path');
const { Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, Utilisateur, MoyenPaiement, Recu, Boutique } = require('../models');
const { genererRecuPDF } = require('../services/recuService');

// GET /api/recus/:vente_id/pdf -- Génère (si besoin) et renvoie le chemin du PDF
exports.genererRecu = async (req, res) => {
  try {
    const vente = await Vente.findOne({
      where: { id: req.params.vente_id, boutique_id: req.utilisateur.boutique_id },
      include: [
        { model: DetailVente, include: [{ model: ProduitTaille, include: [{ model: ProduitVariante, include: [Produit] }] }] },
        { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
        { model: MoyenPaiement },
        { model: Recu },
      ],
    });
    if (!vente) return res.status(404).json({ message: 'Vente introuvable.' });

    const boutique = await Boutique.findByPk(req.utilisateur.boutique_id);

    const cheminRelatif = genererRecuPDF(vente, boutique);

    if (vente.Recu) {
      vente.Recu.chemin_pdf = cheminRelatif;
      await vente.Recu.save();
    } else {
      await Recu.create({ vente_id: vente.id, chemin_pdf: cheminRelatif });
    }

    res.json({ message: 'Reçu généré.', chemin: cheminRelatif });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/recus/:vente_id/telecharger -- Télécharge directement le PDF
exports.telechargerRecu = async (req, res) => {
  try {
    const vente = await Vente.findOne({
      where: { id: req.params.vente_id, boutique_id: req.utilisateur.boutique_id },
      include: [Recu],
    });
    if (!vente || !vente.Recu || !vente.Recu.chemin_pdf) {
      return res.status(404).json({ message: 'Reçu non trouvé. Générez-le d\'abord.' });
    }
    const cheminAbsolu = path.join(__dirname, '..', vente.Recu.chemin_pdf);
    res.download(cheminAbsolu);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
