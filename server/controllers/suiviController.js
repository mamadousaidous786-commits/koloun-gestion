const { CommandeSpeciale, SuiviCommandeSpeciale, Boutique } = require('../models');

const ETAPES = [
  { statut: 'commandee', label: 'Commande passée' },
  { statut: 'entrepot', label: "Arrivée à l'entrepôt" },
  { statut: 'en_transit', label: 'En route vers Conakry' },
  { statut: 'arrivee', label: 'Arrivée à Conakry' },
  { statut: 'livree', label: 'Livrée' },
];

// GET /api/suivi/:code -- PUBLIC : le client suit sa commande (aucun prix, aucune donnée sensible)
exports.consulter = async (req, res) => {
  try {
    const code = String(req.params.code || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (code.length < 6) return res.status(404).json({ message: 'Commande introuvable.' });
    const c = await CommandeSpeciale.findOne({
      where: { code_suivi: code },
      include: [{ model: SuiviCommandeSpeciale, as: 'suivi' }],
      order: [[{ model: SuiviCommandeSpeciale, as: 'suivi' }, 'id', 'ASC']],
    });
    if (!c) return res.status(404).json({ message: 'Commande introuvable. Vérifiez votre lien.' });
    const boutique = await Boutique.findByPk(c.boutique_id, { attributes: ['nom', 'telephone'] });

    const dates = {};
    (c.suivi || []).forEach((s) => { dates[s.statut] = { date: s.created_at, note: s.note }; });
    res.json({
      article: c.article,
      image: c.image,
      photos: (c.articles || []).filter((a) => a.image).map((a) => ({ image: a.image, legende: [a.nom, a.taille ? `taille ${a.taille}` : ''].filter(Boolean).join(' — ') })),
      client: (c.client_nom || '').split(' ')[0],
      statut: c.statut,
      date_livraison_prevue: c.date_livraison_prevue,
      boutique: { nom: boutique?.nom || 'Koloun Luxure', telephone: boutique?.telephone || null },
      etapes: ETAPES.map((e) => ({ ...e, date: dates[e.statut]?.date || null, note: dates[e.statut]?.note || null })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};
