const path = require('path');
const crypto = require('crypto');
const { Vente, DetailVente, ProduitTaille, ProduitVariante, Produit, Utilisateur, MoyenPaiement, Recu, Boutique, Client } = require('../models');
const { genererRecuPDF, envoyerRecuPDF } = require('../services/recuService');

const INCLUS_VENTE = [
  { model: DetailVente, include: [{ model: ProduitTaille, include: [{ model: ProduitVariante, include: [Produit] }] }] },
  { model: Utilisateur, attributes: ['id', 'nom', 'prenom'] },
  { model: MoyenPaiement },
  { model: Client },
  { model: Recu },
];

function urlBase(req) {
  return `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
}

// GET /api/recus/:vente_id/pdf -- Génère le reçu, renvoie le chemin du PDF et un lien de partage permanent
exports.genererRecu = async (req, res) => {
  try {
    const vente = await Vente.findOne({
      where: { id: req.params.vente_id, boutique_id: req.utilisateur.boutique_id },
      include: INCLUS_VENTE,
    });
    if (!vente) return res.status(404).json({ message: 'Vente introuvable.' });

    const boutique = await Boutique.findByPk(req.utilisateur.boutique_id);
    const cheminRelatif = genererRecuPDF(vente, boutique);

    let recu = vente.Recu;
    if (recu) {
      recu.chemin_pdf = cheminRelatif;
    } else {
      recu = Recu.build({ vente_id: vente.id, chemin_pdf: cheminRelatif });
    }
    if (!recu.token) recu.token = crypto.randomBytes(16).toString('hex'); // jeton impossible à deviner
    await recu.save();

    res.json({
      message: 'Reçu généré.',
      chemin: cheminRelatif,
      lien_public: `${urlBase(req)}/api/recus/public/${recu.token}`,
      client_telephone: vente.Client?.telephone || null,
      numero_recu: vente.numero_recu,
      montant_total: vente.montant_total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/recus/public/:token -- lien de partage (sans connexion) : le PDF est recréé à chaque ouverture
exports.recuPublic = async (req, res) => {
  try {
    const recu = await Recu.findOne({ where: { token: req.params.token } });
    if (!recu) return res.status(404).send('Reçu introuvable.');

    const vente = await Vente.findOne({ where: { id: recu.vente_id }, include: INCLUS_VENTE });
    if (!vente) return res.status(404).send('Reçu introuvable.');
    const boutique = await Boutique.findByPk(vente.boutique_id);

    envoyerRecuPDF(vente, boutique, res);
  } catch (error) {
    res.status(500).send('Erreur serveur.');
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
    res.download(path.join(__dirname, '..', vente.Recu.chemin_pdf));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
