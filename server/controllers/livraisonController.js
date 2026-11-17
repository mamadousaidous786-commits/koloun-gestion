const { Op } = require('sequelize');
const { Livraison, LivraisonArticle, Utilisateur } = require('../models');

const nombre = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '')); return Number.isFinite(n) ? n : 0; };
const jourValide = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(j || '') ? j : new Date().toISOString().slice(0, 10));

// Lit les lignes d'articles envoyées par le formulaire : [{ designation, taille, image? }] ; la photo de la ligne i est le fichier « image_i »
function lignesArticles(req) {
  let lignes = [];
  try { lignes = JSON.parse(req.body.articles || '[]'); } catch { lignes = []; }
  const fichiers = {};
  (req.files || []).forEach((f) => { fichiers[f.fieldname] = f.path; });
  return lignes
    .map((l, i) => ({
      designation: String(l.designation || '').trim(),
      taille: String(l.taille || '').trim() || null,
      image: fichiers[`image_${i}`] || (l.image ? String(l.image) : null),
    }))
    .filter((l) => l.designation);
}

// Anciennes livraisons (sans lignes) : on fabrique une ligne à partir des champs d'origine
function avecArticles(l) {
  const j = l.toJSON();
  if (!j.articles || j.articles.length === 0) j.articles = [{ id: 0, designation: j.article, taille: j.taille, image: j.image }];
  return j;
}

// Résumé stocké sur la livraison (recherches, anciennes pages)
const resume = (lignes) => ({
  article: lignes.map((l) => l.designation).join(' + ').slice(0, 200),
  taille: lignes.map((l) => l.taille).filter(Boolean).join(', ').slice(0, 30) || null,
  image: lignes.find((l) => l.image)?.image || null,
});

const INCLUS = [
  { model: LivraisonArticle, as: 'articles', required: false },
  { model: Utilisateur, as: 'createur', attributes: ['id', 'nom', 'prenom'], required: false },
  { model: Utilisateur, as: 'validateur', attributes: ['id', 'nom', 'prenom'], required: false },
];

// GET /api/livraisons?jour=AAAA-MM-JJ -- toutes les livraisons du jour + celles encore « en cours » des jours passés
exports.lister = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const jour = jourValide(req.query.jour);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const where = { boutique_id, [Op.or]: [{ date_livraison: jour }] };
    if (jour >= aujourdhui) where[Op.or].push({ statut: 'en_cours', date_livraison: { [Op.lt]: jour } });
    const livraisons = await Livraison.findAll({ where, include: INCLUS, order: [['statut', 'ASC'], ['created_at', 'DESC'], [{ model: LivraisonArticle, as: 'articles' }, 'id', 'ASC']] });
    res.json(livraisons.map(avecArticles));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/livraisons (multipart : articles = JSON [{designation, taille}], photos image_0, image_1…) -- tous les utilisateurs
exports.creer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const { client_nom, client_telephone, adresse, livreur, note } = req.body;
    if (!client_nom || !client_nom.trim()) return res.status(400).json({ message: 'Indiquez le nom du client.' });
    const lignes = lignesArticles(req);
    if (lignes.length === 0) return res.status(400).json({ message: "Ajoutez au moins un article à livrer." });
    const date_livraison = jourValide(req.body.date_livraison);

    const prefixe = `LIV-${date_livraison.replace(/-/g, '')}-`;
    const nb = await Livraison.count({ where: { boutique_id, numero: { [Op.like]: `${prefixe}%` } } });
    const livraison = await Livraison.create({
      boutique_id,
      numero: `${prefixe}${String(nb + 1).padStart(3, '0')}`,
      date_livraison,
      client_nom: client_nom.trim(),
      client_telephone: client_telephone || null,
      adresse: adresse || null,
      ...resume(lignes),
      montant_livraison: Math.max(0, nombre(req.body.montant_livraison)),
      montant_a_encaisser: Math.max(0, nombre(req.body.montant_a_encaisser)),
      livreur: livreur || null,
      note: note || null,
      cree_par: req.utilisateur.id,
    });
    await LivraisonArticle.bulkCreate(lignes.map((l) => ({ ...l, livraison_id: livraison.id })));
    res.status(201).json(avecArticles(await Livraison.findByPk(livraison.id, { include: INCLUS })));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/livraisons/:id -- modifier une livraison encore en cours
exports.modifier = async (req, res) => {
  try {
    const l = await Livraison.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!l) return res.status(404).json({ message: 'Livraison introuvable.' });
    if (l.statut !== 'en_cours' && req.utilisateur.role !== 'admin') return res.status(400).json({ message: 'Cette livraison est déjà clôturée.' });
    const b = req.body;
    const lignes = lignesArticles(req);
    if (lignes.length === 0) return res.status(400).json({ message: 'Ajoutez au moins un article à livrer.' });
    await l.update({
      client_nom: (b.client_nom || l.client_nom).trim(),
      client_telephone: b.client_telephone ?? l.client_telephone,
      adresse: b.adresse ?? l.adresse,
      ...resume(lignes),
      date_livraison: b.date_livraison ? jourValide(b.date_livraison) : l.date_livraison,
      montant_livraison: b.montant_livraison !== undefined ? Math.max(0, nombre(b.montant_livraison)) : l.montant_livraison,
      montant_a_encaisser: b.montant_a_encaisser !== undefined ? Math.max(0, nombre(b.montant_a_encaisser)) : l.montant_a_encaisser,
      livreur: b.livreur ?? l.livreur,
      note: b.note ?? l.note,
    });
    await LivraisonArticle.destroy({ where: { livraison_id: l.id } });
    await LivraisonArticle.bulkCreate(lignes.map((x) => ({ ...x, livraison_id: l.id })));
    res.json(avecArticles(await Livraison.findByPk(l.id, { include: INCLUS })));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/livraisons/:id/statut  { statut: 'livree' | 'annulee' | 'en_cours', motif }
exports.changerStatut = async (req, res) => {
  try {
    const { statut, motif } = req.body;
    if (!['livree', 'annulee', 'en_cours'].includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });
    const l = await Livraison.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!l) return res.status(404).json({ message: 'Livraison introuvable.' });
    // Seul l'administrateur peut rouvrir une livraison déjà validée
    if (statut === 'en_cours' && req.utilisateur.role !== 'admin') return res.status(403).json({ message: "Seul l'administrateur peut remettre une livraison en cours." });
    if (statut !== 'en_cours' && l.statut !== 'en_cours' && req.utilisateur.role !== 'admin') return res.status(400).json({ message: 'Cette livraison est déjà validée.' });
    if (statut === 'annulee' && !(motif || '').trim()) return res.status(400).json({ message: "Indiquez le motif de l'annulation." });
    await l.update({
      statut,
      motif: statut === 'annulee' ? motif.trim().slice(0, 255) : null,
      valide_par: statut === 'en_cours' ? null : req.utilisateur.id,
      date_validation: statut === 'en_cours' ? null : new Date(),
    });
    res.json(avecArticles(await Livraison.findByPk(l.id, { include: INCLUS })));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/livraisons/:id -- administrateur
exports.supprimer = async (req, res) => {
  try {
    const n = await Livraison.destroy({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!n) return res.status(404).json({ message: 'Livraison introuvable.' });
    res.json({ message: 'Livraison supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
