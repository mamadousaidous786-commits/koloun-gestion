const crypto = require('crypto');
const { CommandeSpeciale, PaiementCommandeSpeciale, SuiviCommandeSpeciale, MoyenPaiement, Notification, Boutique } = require('../models');
const { envoyerRecuCommandeSpeciale } = require('../services/recuService');
const { Op } = require('sequelize');
const { avecSoldeCommande } = require('../utils/soldes');
const { trouverOuCreerClient } = require('../utils/clients');

const STATUTS = ['en_attente', 'commandee', 'entrepot', 'en_transit', 'arrivee', 'livree', 'annulee'];
const INCLUS = [
  { model: PaiementCommandeSpeciale, as: 'paiements', include: [{ model: MoyenPaiement }] },
  { model: SuiviCommandeSpeciale, as: 'suivi' },
];
const ORDRE_SUIVI = [[{ model: SuiviCommandeSpeciale, as: 'suivi' }, 'id', 'ASC']];
const nouveauCode = () => crypto.randomBytes(6).toString('hex').slice(0, 10);

// Lignes envoyées par le formulaire : articles = JSON [{ nom, taille, image? }] ; la photo de la ligne i est le fichier « image_i ».
// Nom et taille sont facultatifs ; une ligne sans nom, taille ni photo est ignorée.
function lireArticles(req) {
  let lignes = [];
  try { lignes = JSON.parse(req.body.articles || '[]'); } catch { lignes = []; }
  if (!Array.isArray(lignes)) lignes = [];
  const fichiers = {};
  (req.files || []).forEach((f) => { fichiers[f.fieldname] = f.path; });
  const articles = lignes.map((l, i) => ({
    nom: String(l?.nom || '').trim().slice(0, 150),
    taille: String(l?.taille || '').trim().slice(0, 50),
    image: fichiers[`image_${i}`] || (typeof l?.image === 'string' && l.image ? l.image : null),
  })).filter((a) => a.nom || a.taille || a.image).slice(0, 30);
  // Ancien formulaire : une seule photo envoyée sous le nom « image »
  if (!articles.length && fichiers.image) articles.push({ nom: '', taille: '', image: fichiers.image });
  return articles;
}

// Libellé court de la commande (liste, reçu, messages WhatsApp)
function resume(articles, saisi) {
  if (saisi && saisi.trim()) return saisi.trim().slice(0, 200);
  const noms = articles.map((a) => a.nom).filter(Boolean);
  if (noms.length) return noms.join(' + ').slice(0, 200);
  return articles.length > 1 ? `${articles.length} articles (voir photos)` : 'Article (voir photo)';
}

const nombre = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));

async function charger(id, boutique_id) {
  return CommandeSpeciale.findOne({ where: { id, boutique_id }, include: INCLUS, order: ORDRE_SUIVI });
}

// GET /api/commandes-speciales?statut=&q=
exports.lister = async (req, res) => {
  try {
    const where = { boutique_id: req.utilisateur.boutique_id };
    if (req.query.statut && STATUTS.includes(req.query.statut)) where.statut = req.query.statut;
    const q = (req.query.q || '').trim();
    if (q) where[Op.or] = [{ client_nom: { [Op.like]: `%${q}%` } }, { article: { [Op.like]: `%${q}%` } }];

    const commandes = await CommandeSpeciale.findAll({ where, include: INCLUS, order: [['created_at', 'DESC'], ...ORDRE_SUIVI] });
    // Toute commande sans lien de suivi en reçoit un automatiquement
    await Promise.all(commandes.filter((c) => !c.code_suivi).map((c) => c.update({ code_suivi: nouveauCode() })));
    res.json(commandes.map(avecSoldeCommande));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/commandes-speciales  (multipart : photo facultative ; acompte facultatif)
exports.creer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { client_id, client_nom, client_telephone, article, details, date_livraison_prevue, observation, moyen_paiement_id } = req.body;
    const prix_total = nombre(req.body.prix_total);
    const acompte = nombre(req.body.acompte); // facultatif : 0 si non renseigné

    const articles = lireArticles(req);
    if (!articles.length && !(article || '').trim()) return res.status(400).json({ message: 'Ajoutez au moins une photo ou le nom d\'un article.' });
    if (!(prix_total > 0)) return res.status(400).json({ message: 'Le prix total doit être supérieur à 0.' });
    if (acompte < 0) return res.status(400).json({ message: "L'avance ne peut pas être négative." });
    if (acompte > prix_total) return res.status(400).json({ message: "L'avance ne peut pas dépasser le prix total." });

    const client = await trouverOuCreerClient(boutique_id, { client_id, nom: client_nom, telephone: client_telephone });
    if (!client) return res.status(400).json({ message: 'Indiquez le nom du client.' });

    const commande = await CommandeSpeciale.create({
      boutique_id,
      client_id: client.id,
      client_nom: client.nom,
      client_telephone: client_telephone || client.telephone || null,
      article: resume(articles, article),
      details,
      articles,
      image: articles.find((a) => a.image)?.image || null,
      prix_total,
      date_livraison_prevue: date_livraison_prevue || null,
      observation,
      code_suivi: nouveauCode(),
    });
    await SuiviCommandeSpeciale.create({ commande_speciale_id: commande.id, statut: 'en_attente' });

    if (acompte > 0) {
      await PaiementCommandeSpeciale.create({
        commande_speciale_id: commande.id,
        montant: acompte,
        moyen_paiement_id: moyen_paiement_id || 3,
        note: 'Avance à la commande',
      });
    }

    res.status(201).json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes-speciales/:id
exports.modifier = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const champs = {};
    ['client_nom', 'client_telephone', 'article', 'details', 'date_livraison_prevue', 'observation'].forEach((k) => {
      if (req.body[k] !== undefined) champs[k] = req.body[k] === '' ? null : req.body[k];
    });
    if (req.body.prix_total !== undefined) {
      const prix = nombre(req.body.prix_total);
      if (!(prix > 0)) return res.status(400).json({ message: 'Le prix total doit être supérieur à 0.' });
      champs.prix_total = prix;
    }
    if (req.body.articles !== undefined) {
      const articles = lireArticles(req);
      champs.articles = articles;
      champs.image = articles.find((a) => a.image)?.image || null;
      if (!(req.body.article || '').trim()) champs.article = resume(articles);
    } else {
      const photo = (req.files || [])[0];
      if (photo) champs.image = photo.path;
    }
    await commande.update(champs);

    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/commandes-speciales/:id/statut
exports.changerStatut = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { statut } = req.body;
    if (!STATUTS.includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });

    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const ancien = commande.statut;
    await commande.update({ statut });
    if (statut !== ancien) {
      await SuiviCommandeSpeciale.create({ commande_speciale_id: commande.id, statut, note: (req.body.note || '').trim().slice(0, 255) || null });
    }

    if (statut === 'arrivee' && ancien !== 'arrivee') {
      await Notification.create({
        boutique_id,
        type: 'commande_speciale_arrivee',
        message: `La commande spéciale de ${commande.client_nom} (${commande.article}) est arrivée.`,
      });
    }

    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/commandes-speciales/:id/paiements
exports.ajouterPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });

    const montant = nombre(req.body.montant);
    if (!(montant > 0)) return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });

    const { reste } = avecSoldeCommande(commande);
    if (montant > reste) return res.status(400).json({ message: `Le montant dépasse le reste à payer (${reste.toLocaleString('fr-FR')} GNF).` });

    await PaiementCommandeSpeciale.create({
      commande_speciale_id: commande.id,
      montant,
      moyen_paiement_id: req.body.moyen_paiement_id || 3,
      note: req.body.note || null,
    });

    res.status(201).json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/commandes-speciales/:id/paiements/:paiementId  (admin)
exports.supprimerPaiement = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const commande = await charger(req.params.id, boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    const paiement = await PaiementCommandeSpeciale.findOne({ where: { id: req.params.paiementId, commande_speciale_id: commande.id } });
    if (!paiement) return res.status(404).json({ message: 'Paiement introuvable.' });
    await paiement.destroy();
    res.json(avecSoldeCommande(await charger(commande.id, boutique_id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/commandes-speciales/:id  (admin)
exports.supprimer = async (req, res) => {
  try {
    const commande = await CommandeSpeciale.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    await commande.destroy();
    res.json({ message: 'Commande supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/commandes-speciales/:id/recu -- reçu PDF (acompte versé + reste à payer)
exports.recu = async (req, res) => {
  try {
    const commande = await charger(req.params.id, req.utilisateur.boutique_id);
    if (!commande) return res.status(404).json({ message: 'Commande introuvable.' });
    const boutique = await Boutique.findByPk(req.utilisateur.boutique_id);
    envoyerRecuCommandeSpeciale(commande, boutique, res);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
