// ============================================================
// PROMOTIONS — page « Promotions » de Koloun Gestion (admin)
// ============================================================
const sequelize = require('../config/database');
const promotions = require('../utils/promotions');

const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = [], transaction) => sequelize.query(t, { ...SELECT, replacements: r, transaction });
const erreur = (code, message) => Object.assign(new Error(message), { code });
const repondre = (res, e, defaut) => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code && e.code < 500 ? e.message : defaut, erreur: e.code && e.code < 500 ? undefined : e.message });
// « 2026-11-29T23:59 » ou « 2026-11-29 23:59 » → valeur MySQL
const dateSql = (v) => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/); return m ? `${m[1]} ${m[2]}:00` : null; };

// GET /api/promotions
exports.lister = async (req, res) => {
  try {
    const l = await sql(`SELECT p.*, (SELECT COUNT(*) FROM promotion_produits x WHERE x.promotion_id = p.id) AS nb_articles,
        CASE WHEN p.actif = 0 THEN 'arretee' WHEN p.fin <= NOW() THEN 'terminee' WHEN p.debut > NOW() THEN 'a_venir' ELSE 'en_cours' END AS etat
      FROM promotions p WHERE p.boutique_id = ? ORDER BY p.fin > NOW() DESC, p.debut DESC LIMIT 100`, [req.utilisateur.boutique_id]);
    res.json(l.map((p) => ({ ...p, pourcentage: Number(p.pourcentage), nb_articles: Number(p.nb_articles) })));
  } catch (e) { repondre(res, e, 'Impossible de charger les promotions.'); }
};

// GET /api/promotions/produits — articles que l'on peut mettre en promotion
exports.produits = async (req, res) => {
  try {
    const l = await sql(`SELECT p.id, p.nom, p.prix_normal, p.categorie, p.created_at,
        (SELECT v.image FROM produit_variantes v WHERE v.produit_id = p.id ORDER BY v.id LIMIT 1) AS image
      FROM produits p WHERE p.boutique_id = ? ORDER BY p.created_at DESC`, [req.utilisateur.boutique_id]);
    res.json(l.map((p) => ({ ...p, prix_normal: Math.round(Number(p.prix_normal)) })));
  } catch (e) { repondre(res, e, 'Impossible de charger les articles.'); }
};

// POST /api/promotions { nom, pourcentage, debut, fin, produits?: [ids] }  (sans liste : tous les articles actuels)
exports.creer = async (req, res) => {
  let t;
  try {
    const b = req.utilisateur.boutique_id;
    const nom = String(req.body.nom || '').trim().slice(0, 80) || 'Promotion';
    const pourcentage = Number(req.body.pourcentage);
    if (!(pourcentage > 0 && pourcentage < 100)) throw erreur(400, 'Le pourcentage doit être entre 1 et 99.');
    const debut = dateSql(req.body.debut) || null;
    const fin = dateSql(req.body.fin);
    if (!fin) throw erreur(400, 'Indiquez la date et l\'heure de fin.');
    t = await sequelize.transaction();
    const [id] = await sequelize.query('INSERT INTO promotions (boutique_id, nom, pourcentage, debut, fin, cree_par) VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?)',
      { type: sequelize.QueryTypes.INSERT, replacements: [b, nom, pourcentage, debut, fin, req.utilisateur.id], transaction: t });
    const [p] = await sql('SELECT debut, fin FROM promotions WHERE id = ?', [id], t);
    if (new Date(p.fin) <= new Date(p.debut)) throw erreur(400, 'La fin doit être après le début.');
    // Articles : la liste choisie, sinon tous les articles qui existent maintenant
    const choisis = Array.isArray(req.body.produits) ? req.body.produits.map(Number).filter(Boolean) : null;
    const ids = choisis
      ? (await sql(`SELECT id FROM produits WHERE boutique_id = ? AND id IN (${choisis.length ? choisis.join(',') : 0})`, [b], t)).map((x) => x.id)
      : (await sql('SELECT id FROM produits WHERE boutique_id = ?', [b], t)).map((x) => x.id);
    if (!ids.length) throw erreur(400, 'Choisissez au moins un article.');
    await sequelize.query(`INSERT INTO promotion_produits (promotion_id, produit_id) VALUES ${ids.map(() => '(?, ?)').join(',')}`,
      { replacements: ids.flatMap((x) => [id, x]), transaction: t });
    await t.commit();
    promotions.invalider();
    res.status(201).json({ id, nb_articles: ids.length });
  } catch (e) {
    if (t) await t.rollback().catch(() => {});
    repondre(res, e, "La promotion n'a pas pu être créée.");
  }
};

// PUT /api/promotions/:id { fin?, actif? } — prolonger ou arrêter
exports.modifier = async (req, res) => {
  try {
    const [p] = await sql('SELECT id FROM promotions WHERE id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!p) throw erreur(404, 'Promotion introuvable.');
    const fin = req.body.fin !== undefined ? dateSql(req.body.fin) : undefined;
    if (req.body.fin !== undefined && !fin) throw erreur(400, 'Date de fin invalide.');
    await sequelize.query(`UPDATE promotions SET ${[fin !== undefined && 'fin = ?', req.body.actif !== undefined && 'actif = ?'].filter(Boolean).join(', ') || 'id = id'} WHERE id = ?`,
      { replacements: [...(fin !== undefined ? [fin] : []), ...(req.body.actif !== undefined ? [req.body.actif ? 1 : 0] : []), p.id] });
    promotions.invalider();
    res.json({ ok: true });
  } catch (e) { repondre(res, e, "La promotion n'a pas pu être modifiée."); }
};
