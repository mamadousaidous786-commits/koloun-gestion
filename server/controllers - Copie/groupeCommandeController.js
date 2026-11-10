const { GroupeCommande, Commande, Fournisseur, sequelize } = require('../models');

const INCLUS = [{ model: Commande, include: [{ model: Fournisseur }] }];

// GET /api/groupes-commande
exports.lister = async (req, res) => {
  try {
    const groupes = await GroupeCommande.findAll({
      where: { boutique_id: req.utilisateur.boutique_id },
      include: INCLUS,
      order: [['date_commande', 'DESC'], ['id', 'DESC'], [Commande, 'id', 'ASC']],
    });
    res.json(groupes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/groupes-commande  { nom, date_commande }
exports.creer = async (req, res) => {
  try {
    const { nom, date_commande } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ message: 'Donnez un nom au groupe.' });
    const groupe = await GroupeCommande.create({
      boutique_id: req.utilisateur.boutique_id,
      nom: nom.trim(),
      date_commande: date_commande || new Date().toISOString().slice(0, 10),
    });
    await groupe.reload({ include: INCLUS });
    res.status(201).json(groupe);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/groupes-commande/:id/transport  { transport }
// VALIDE le transport : le montant est réparti sur toutes les pièces du groupe
// (transport par pièce = transport total ÷ nombre total de pièces), puis le groupe est verrouillé.
exports.validerTransport = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const transport = Number(req.body.transport);
    if (!Number.isFinite(transport) || transport < 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Montant de transport invalide.' });
    }

    const groupe = await GroupeCommande.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
      include: [{ model: Commande }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!groupe) { await t.rollback(); return res.status(404).json({ message: 'Groupe introuvable.' }); }
    if (groupe.transport_valide) { await t.rollback(); return res.status(400).json({ message: 'Le transport de ce groupe est déjà validé.' }); }

    const commandes = groupe.Commandes || [];
    const piecesTotal = commandes.reduce((a, c) => a + Number(c.quantite_totale), 0);
    if (commandes.length === 0 || piecesTotal === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Ajoutez au moins une commande au groupe avant de valider le transport.' });
    }

    // Répartition au prorata des pièces ; la dernière commande reçoit le reste (aucun centime perdu)
    let reparti = 0;
    for (let i = 0; i < commandes.length; i += 1) {
      const c = commandes[i];
      const part = i === commandes.length - 1
        ? Math.round((transport - reparti) * 100) / 100
        : Math.round((transport * Number(c.quantite_totale) / piecesTotal) * 100) / 100;
      reparti += part;
      c.transport = part;
      await c.save({ transaction: t });
    }

    groupe.transport = transport;
    groupe.transport_valide = true;
    await groupe.save({ transaction: t });
    await t.commit();

    await groupe.reload({ include: INCLUS });
    res.json(groupe);
  } catch (error) {
    await t.rollback().catch(() => {});
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/groupes-commande/:id  (seulement si le transport n'est pas encore validé)
exports.supprimer = async (req, res) => {
  try {
    const groupe = await GroupeCommande.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!groupe) return res.status(404).json({ message: 'Groupe introuvable.' });
    if (groupe.transport_valide) return res.status(400).json({ message: 'Un groupe dont le transport est validé ne peut plus être supprimé.' });
    await groupe.destroy(); // ses commandes restent, simplement détachées
    res.json({ message: 'Groupe supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
