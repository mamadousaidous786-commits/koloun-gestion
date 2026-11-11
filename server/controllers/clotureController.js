const { sequelize, Vente, MoyenPaiement, ClotureCaisse, Depense, Utilisateur } = require('../models');
const { Op } = require('sequelize');

function jourValide(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
}

// Calcule ce que la caisse devrait contenir pour un jour donné, d'après les ventes enregistrées
async function calculerAttendu(boutique_id, date) {
  const ventes = await Vente.findAll({
    where: {
      boutique_id,
      [Op.and]: [sequelize.where(sequelize.fn('DATE', sequelize.col('Vente.date_vente')), date)],
    },
    include: [{ model: MoyenPaiement }],
  });

  const attendu = { cash: 0, om: 0, pm: 0 };
  ventes.forEach((v) => {
    const nom = v.MoyenPaiement?.nom;
    const montant = Number(v.montant_total);
    if (nom === 'Cash') attendu.cash += montant;
    else if (nom === 'Orange Money') attendu.om += montant;
    else if (nom === 'Paiement Marchand') attendu.pm += montant;
  });
  return { nombre_ventes: ventes.length, attendu, total: attendu.cash + attendu.om + attendu.pm };
}

const nombreOuNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// GET /api/clotures/apercu?date=YYYY-MM-DD
exports.apercu = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const date = jourValide(req.query.date);
    const calcul = await calculerAttendu(boutique_id, date);
    const depensesJour = await Depense.sum('montant', { where: { boutique_id, date_depense: date } }) || 0;
    const existante = await ClotureCaisse.findOne({ where: { boutique_id, date_cloture: date } });
    res.json({ date, ...calcul, depenses_jour: Number(depensesJour), cloture_existante: existante });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/clotures  -- enregistre (ou met à jour) la clôture d'un jour
exports.enregistrer = async (req, res) => {
  try {
    const boutique_id = req.utilisateur.boutique_id;
    const date = jourValide(req.body.date);
    const compte_cash = nombreOuNull(req.body.compte_cash);
    const compte_om = nombreOuNull(req.body.compte_om);
    const compte_pm = nombreOuNull(req.body.compte_pm);

    if (compte_cash === null) return res.status(400).json({ message: "Indiquez l'argent liquide compté en caisse." });

    const { attendu } = await calculerAttendu(boutique_id, date);
    const donnees = {
      boutique_id,
      utilisateur_id: req.utilisateur.id,
      date_cloture: date,
      attendu_cash: attendu.cash, attendu_om: attendu.om, attendu_pm: attendu.pm,
      compte_cash, compte_om, compte_pm,
      ecart_cash: compte_cash - attendu.cash,
      ecart_om: compte_om === null ? null : compte_om - attendu.om,
      ecart_pm: compte_pm === null ? null : compte_pm - attendu.pm,
      note: req.body.note || null,
    };

    const existante = await ClotureCaisse.findOne({ where: { boutique_id, date_cloture: date } });
    const cloture = existante ? await existante.update(donnees) : await ClotureCaisse.create(donnees);
    res.status(existante ? 200 : 201).json(cloture);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/clotures?limite=30
exports.lister = async (req, res) => {
  try {
    const clotures = await ClotureCaisse.findAll({
      where: { boutique_id: req.utilisateur.boutique_id },
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'prenom'] }],
      order: [['date_cloture', 'DESC']],
      limit: Math.min(Number(req.query.limite) || 30, 120),
    });
    res.json(clotures);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/clotures/:id  -- supprime une clôture (on peut ensuite la refaire)
exports.supprimer = async (req, res) => {
  try {
    const cloture = await ClotureCaisse.findOne({ where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id } });
    if (!cloture) return res.status(404).json({ message: 'Clôture introuvable.' });
    await cloture.destroy();
    res.json({ message: 'Clôture supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
