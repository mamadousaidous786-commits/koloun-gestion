// Gestion → Agent IA : page de test, commandes transmises par l'agent, état et coût du mois
const sequelize = require('../config/database');
const agent = require('../utils/agentKoloun');

const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = []) => sequelize.query(t, { ...SELECT, replacements: r });
const exec = (t, r = []) => sequelize.query(t, { replacements: r });
const erreur = (res, e, m = 'Erreur serveur.') => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code && e.code < 500 ? e.message : m, erreur: e.message });

// GET /api/agent/etat
exports.etat = async (req, res) => {
  try {
    const depense = await agent.depenseDuMois();
    const [n] = await sql("SELECT COUNT(*) AS n FROM agent_demandes WHERE boutique_id = ? AND statut = 'nouvelle'", [agent.BOUTIQUE_ID]);
    res.json({ actif: agent.actif(), modele: agent.MODELE, remise_max: agent.REMISE_MAX, budget_mois: agent.BUDGET_MOIS, depense_mois: Math.round(depense.dollars * 100) / 100, reponses_mois: depense.reponses, demandes_nouvelles: Number(n.n) });
  } catch (e) { erreur(res, e); }
};

// POST /api/agent/test { texte, session }  — discuter avec l'agent comme un client
exports.tester = async (req, res) => {
  try {
    const texte = String(req.body.texte || '').trim();
    if (!texte) return res.status(400).json({ message: 'Écrivez un message.' });
    const session = String(req.body.session || 'defaut').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    const r = await agent.repondre({ canal: 'test', identifiant: `gestion-${req.utilisateur.id}-${session}`, texte, nom: req.body.nom || null });
    res.json(r);
  } catch (e) { erreur(res, e, "L'agent n'a pas pu répondre."); }
};

// POST /api/agent/test/reprendre { session } — rendre la main à l'agent après un « passer à un humain »
exports.rendreLaMain = async (req, res) => {
  try {
    const session = String(req.body.session || 'defaut').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    await exec("UPDATE agent_conversations SET mode = 'ia' WHERE boutique_id = ? AND canal = 'test' AND identifiant = ?", [agent.BOUTIQUE_ID, `gestion-${req.utilisateur.id}-${session}`]);
    res.json({ ok: true });
  } catch (e) { erreur(res, e); }
};

// GET /api/agent/demandes?statut=nouvelle|traitee|annulee|toutes
exports.demandes = async (req, res) => {
  try {
    const statut = req.query.statut || 'nouvelle';
    const r = [agent.BOUTIQUE_ID]; let f = '';
    if (statut !== 'toutes') { f = ' AND d.statut = ?'; r.push(statut); }
    const liste = await sql(`SELECT d.*, CONCAT_WS(' ', u.nom, u.prenom) AS traite_par_nom FROM agent_demandes d LEFT JOIN utilisateurs u ON u.id = d.traite_par
      WHERE d.boutique_id = ?${f} ORDER BY d.created_at DESC LIMIT 200`, r);
    res.json(liste.map((d) => ({ ...d, total: Math.round(Number(d.total)), lignes: (() => { try { return JSON.parse(d.lignes); } catch { return []; } })() })));
  } catch (e) { erreur(res, e); }
};

// PUT /api/agent/demandes/:id { statut: 'traitee' | 'annulee' | 'nouvelle' }
exports.traiterDemande = async (req, res) => {
  try {
    const statut = req.body.statut;
    if (!['traitee', 'annulee', 'nouvelle'].includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });
    await exec('UPDATE agent_demandes SET statut = ?, traite_par = ? WHERE id = ? AND boutique_id = ?', [statut, statut === 'nouvelle' ? null : req.utilisateur.id, req.params.id, agent.BOUTIQUE_ID]);
    res.json({ ok: true });
  } catch (e) { erreur(res, e); }
};
