// ============================================================
// KOLOUN BOUTIQUE — API de l'application client
// Lit directement les produits de Koloun Gestion (même base de données).
//  - Partie publique : catalogue, nouveautés, commandes spéciales, passer/suivre une commande
//  - Partie vendeur (token Koloun Gestion) : commandes reçues, réduction de prix, catalogue spécial
// ============================================================
const crypto = require('crypto');
const sequelize = require('../config/database');
const { Notification, Livraison, LivraisonArticle } = require('../models');
const { lireCompte } = require('./compteController');
const chat = require('../utils/chat');
const promotions = require('../utils/promotions'); // prix promo (ex. : Black Friday) // la commande apparaît aussi dans la discussion client ↔ boutique

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (texte, replacements = []) => sequelize.query(texte, { ...SELECT, replacements });
const exec = (texte, replacements = []) => sequelize.query(texte, { replacements }); // écritures (UPDATE / INSERT)

// Statut vu par le client : quand la commande est devenue une livraison dans Koloun Gestion,
// c'est la livraison qui fait foi (en cours → expédiée, livrée, annulée)
const JOINTURE_LIVRAISON = 'LEFT JOIN livraisons lv ON lv.id = c.livraison_id';
const STATUT_SQL = `CASE WHEN c.livraison_id IS NOT NULL AND lv.id IS NULL THEN 'annulee'
  WHEN lv.statut = 'livree' THEN 'livree' WHEN lv.statut = 'annulee' THEN 'annulee'
  WHEN lv.statut = 'en_cours' THEN 'validee' ELSE c.statut END`;
const MOTIF_SQL = `COALESCE(lv.motif, CASE WHEN c.livraison_id IS NOT NULL AND lv.id IS NULL THEN 'Livraison supprimée par la boutique' END, c.motif)`;
exports.JOINTURE_LIVRAISON = JOINTURE_LIVRAISON;
exports.STATUT_SQL = STATUT_SQL;

// Photo stockée en local (/uploads/...) → adresse complète ; Cloudinary → inchangée
function urlImage(req, chemin) {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  return `${req.protocol}://${req.get('host')}${chemin.startsWith('/') ? '' : '/'}${chemin}`;
}

function lireImages(req, brut) {
  if (!brut) return [];
  try { return JSON.parse(brut).map((c) => urlImage(req, c)); } catch { return [urlImage(req, brut)]; }
}

const nombre = (v) => Math.round(Number(v || 0));

// Regroupe les lignes SQL produit/variante/taille en objets produits
function regrouperProduits(req, lignes) {
  const parId = new Map();
  for (const l of lignes) {
    if (!parId.has(l.id)) {
      parId.set(l.id, {
        id: l.id,
        nom: l.nom,
        prix: nombre(l.prix_normal),
        description: l.description || '',
        categorie: l.categorie || null,
        date_ajout: l.created_at,
        variantes: [],
        stock_total: 0,
      });
    }
    const p = parId.get(l.id);
    if (!l.vid) continue;
    let v = p.variantes.find((x) => x.id === l.vid);
    if (!v) {
      v = { id: l.vid, image: urlImage(req, l.image), description: l.vdesc || '', tailles: [] };
      p.variantes.push(v);
    }
    if (l.tid) {
      v.tailles.push({ id: l.tid, taille: l.taille, stock: Math.max(0, Number(l.quantite) || 0) });
      p.stock_total += Math.max(0, Number(l.quantite) || 0);
    }
  }
  return [...parId.values()].filter((p) => p.variantes.length > 0);
}

const REQUETE_PRODUITS = `
  SELECT p.id, p.nom, p.prix_normal, p.description, p.categorie, p.created_at,
         v.id AS vid, v.image, v.description AS vdesc,
         t.id AS tid, t.taille, t.quantite
  FROM produits p
  LEFT JOIN produit_variantes v ON v.produit_id = p.id
  LEFT JOIN produit_tailles t ON t.produit_variante_id = v.id
  WHERE p.boutique_id = ? AND COALESCE(p.visible_boutique, 1) = 1`;

// ------------------------------------------------------------ PUBLIC

// GET /api/boutique/infos
exports.infos = async (req, res) => {
  try {
    const [b] = await sql('SELECT nom, adresse, telephone FROM boutiques WHERE id = ?', [BOUTIQUE_ID]);
    const categories = await sql(
      `SELECT categorie, COUNT(*) AS n FROM produits
       WHERE boutique_id = ? AND categorie IS NOT NULL AND categorie <> '' AND COALESCE(visible_boutique,1)=1
       GROUP BY categorie ORDER BY n DESC`, [BOUTIQUE_ID]);
    // Promotion en cours (bandeau de l'accueil)
    const [promo] = await promotions.enCours(BOUTIQUE_ID);
    res.json({ ...(b || {}), categories: categories.map((c) => c.categorie), promotion: promo ? { nom: promo.nom, pourcentage: promo.pourcentage, fin: promo.fin } : null });
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les informations de la boutique.', erreur: e.message });
  }
};

// GET /api/boutique/produits?recherche=&categorie=
exports.produits = async (req, res) => {
  try {
    const params = [BOUTIQUE_ID];
    let filtre = '';
    if (req.query.recherche) { filtre += ' AND (p.nom LIKE ? OR p.description LIKE ?)'; params.push(`%${req.query.recherche}%`, `%${req.query.recherche}%`); }
    if (req.query.categorie) { filtre += ' AND p.categorie = ?'; params.push(req.query.categorie); }
    const lignes = await sql(`${REQUETE_PRODUITS}${filtre} ORDER BY p.created_at DESC, v.id ASC, t.id ASC`, params);
    res.set('Cache-Control', 'public, max-age=30');
    res.json(await promotions.appliquer(BOUTIQUE_ID, regrouperProduits(req, lignes)));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les articles.', erreur: e.message });
  }
};

// GET /api/boutique/nouveautes  → les 10 derniers articles ajoutés dans Koloun Gestion
exports.nouveautes = async (req, res) => {
  try {
    const ids = await sql(
      `SELECT p.id FROM produits p WHERE p.boutique_id = ? AND COALESCE(p.visible_boutique,1)=1
       AND EXISTS (SELECT 1 FROM produit_variantes v WHERE v.produit_id = p.id)
       ORDER BY p.created_at DESC, p.id DESC LIMIT 10`, [BOUTIQUE_ID]);
    if (!ids.length) return res.json([]);
    const liste = ids.map((r) => r.id);
    const lignes = await sql(`${REQUETE_PRODUITS} AND p.id IN (${liste.map(() => '?').join(',')}) ORDER BY p.created_at DESC, v.id, t.id`, [BOUTIQUE_ID, ...liste]);
    res.json(await promotions.appliquer(BOUTIQUE_ID, regrouperProduits(req, lignes)));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les nouveautés.', erreur: e.message });
  }
};

// GET /api/boutique/produits/:id
exports.produit = async (req, res) => {
  try {
    const lignes = await sql(`${REQUETE_PRODUITS} AND p.id = ? ORDER BY v.id, t.id`, [BOUTIQUE_ID, req.params.id]);
    const [p] = await promotions.appliquer(BOUTIQUE_ID, regrouperProduits(req, lignes));
    if (!p) return res.status(404).json({ message: "Cet article n'est plus disponible." });
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: "Impossible de charger l'article.", erreur: e.message });
  }
};

function formaterSpecial(req, s) {
  return {
    id: s.id,
    nom: s.nom,
    description: s.description || '',
    prix: nombre(s.prix),
    images: lireImages(req, s.images),
    tailles: (s.tailles || '').split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean),
    delai: s.delai,
    actif: !!s.actif,
    date_ajout: s.created_at,
  };
}

// GET /api/boutique/speciales
exports.speciales = async (req, res) => {
  try {
    const liste = await sql('SELECT * FROM catalogue_special WHERE boutique_id = ? AND actif = 1 ORDER BY created_at DESC', [BOUTIQUE_ID]);
    res.json(liste.map((s) => formaterSpecial(req, s)));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les commandes spéciales.', erreur: e.message });
  }
};

// POST /api/boutique/commandes
// { client_nom, client_telephone, note, intention: 'valider'|'discuter',
//   lignes: [{ source:'stock', produit_taille_id, quantite } | { source:'speciale', special_id, taille, quantite }] }
// Les prix sont TOUJOURS recalculés ici depuis la base (jamais repris du téléphone du client).
exports.creerCommande = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const compte = lireCompte(req);
    if (!compte) throw Object.assign(new Error('Connectez-vous ou créez un compte pour valider votre commande.'), { code: 401 });
    const { client_nom, client_telephone, note } = req.body || {};
    const mode = req.body?.mode_livraison === 'retrait' ? 'retrait' : 'livraison';
    const adresse = String(req.body?.adresse || '').trim();
    if (mode === 'livraison' && adresse.length < 3) throw Object.assign(new Error('Indiquez votre quartier ou votre adresse de livraison.'), { code: 400 });
    const lignesDemandees = Array.isArray(req.body?.lignes) ? req.body.lignes.slice(0, 50) : [];
    if (!client_nom || String(client_nom).trim().length < 2) throw Object.assign(new Error('Indiquez votre nom.'), { code: 400 });
    if (!client_telephone || String(client_telephone).replace(/\D/g, '').length < 8) throw Object.assign(new Error('Indiquez un numéro de téléphone valide.'), { code: 400 });
    if (!lignesDemandees.length) throw Object.assign(new Error('Votre panier est vide.'), { code: 400 });

    const lignes = [];
    for (const l of lignesDemandees) {
      const quantite = Math.min(20, Math.max(1, parseInt(l.quantite, 10) || 1));
      if (l.source === 'speciale') {
        const [s] = await sql('SELECT * FROM catalogue_special WHERE id = ? AND boutique_id = ? AND actif = 1', [l.special_id, BOUTIQUE_ID]);
        if (!s) throw Object.assign(new Error("Une paire choisie n'est plus proposée."), { code: 409 });
        const imgs = lireImages(req, s.images);
        lignes.push({ source: 'speciale', special_id: s.id, nom: s.nom, image: imgs[0] || null, taille: l.taille ? String(l.taille).slice(0, 50) : null, quantite, prix_unitaire: nombre(s.prix) });
      } else {
        const [r] = await sql(
          `SELECT t.id AS tid, t.taille, t.quantite AS stock, v.id AS vid, v.image, p.id AS pid, p.nom, p.prix_normal
           FROM produit_tailles t JOIN produit_variantes v ON v.id = t.produit_variante_id JOIN produits p ON p.id = v.produit_id
           WHERE t.id = ? AND p.boutique_id = ?`, [l.produit_taille_id, BOUTIQUE_ID]);
        if (!r) throw Object.assign(new Error("Un article de votre panier n'existe plus."), { code: 409 });
        if (Number(r.stock) < quantite) {
          throw Object.assign(new Error(`« ${r.nom} » taille ${r.taille} : il n'en reste que ${Math.max(0, r.stock)}.`), { code: 409 });
        }
        const tarif = await promotions.prixDe(BOUTIQUE_ID, r.pid, r.prix_normal); // prix promo s'il y en a une
        lignes.push({ source: 'stock', produit_id: r.pid, produit_variante_id: r.vid, produit_taille_id: r.tid, nom: r.nom, image: urlImage(req, r.image), taille: r.taille, quantite, prix_unitaire: tarif.prix });
      }
    }

    const total = lignes.reduce((s, l) => s + l.prix_unitaire * l.quantite, 0);
    const sources = new Set(lignes.map((l) => l.source));
    const type = sources.size > 1 ? 'mixte' : sources.has('speciale') ? 'speciale' : 'panier';
    const d = new Date();
    const reference = `KB-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${crypto.randomInt(1000, 9999)}`;
    const code = crypto.randomBytes(8).toString('hex');

    const [id] = await sequelize.query(
      `INSERT INTO boutique_commandes (boutique_id, reference, code, type, statut, client_nom, client_telephone, note_client, total_initial, total_final, compte_client_id, mode_livraison, adresse)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      { type: sequelize.QueryTypes.INSERT, replacements: [BOUTIQUE_ID, reference, code, type, 'nouvelle',
        String(client_nom).trim().slice(0, 150), String(client_telephone).trim().slice(0, 50), note ? String(note).slice(0, 500) : null, total, total, compte.compte_id,
        mode, mode === 'livraison' ? adresse.slice(0, 255) : null], transaction: t });

    for (const l of lignes) {
      await sequelize.query(
        `INSERT INTO boutique_commande_lignes (commande_id, source, produit_id, produit_variante_id, produit_taille_id, special_id, nom, image, taille, quantite, prix_unitaire)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        { replacements: [id, l.source, l.produit_id || null, l.produit_variante_id || null, l.produit_taille_id || null, l.special_id || null, l.nom, l.image, l.taille, l.quantite, l.prix_unitaire], transaction: t });
    }
    await t.commit();

    // Alerte dans Koloun Gestion (cloche + notification push si activée)
    Notification.create({
      boutique_id: BOUTIQUE_ID,
      type: 'commande_boutique',
      message: `Commande en ligne à confirmer ${reference} — ${String(client_nom).trim()} (${total.toLocaleString('fr-FR')} GNF, ${mode === 'retrait' ? 'retrait en boutique' : `livraison : ${adresse}`})`.slice(0, 255),
    }).catch(() => {});

    chat.messageCommande(compte.compte_id, { id, reference }).catch(() => {});
    res.status(201).json({ reference, code, total, type });
  } catch (e) {
    await t.rollback().catch(() => {});
    res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code ? e.message : "La commande n'a pas pu être enregistrée.", erreur: e.code ? undefined : e.message });
  }
};

async function chargerCommande(where, params) {
  const ou = where.replace(/\b(id|code|boutique_id)\b/g, 'c.$1');
  const [c] = await sql(`SELECT c.*, ${STATUT_SQL} AS statut_reel, ${MOTIF_SQL} AS motif_reel, lv.livreur, lv.date_livraison, lv.numero AS livraison_numero
    FROM boutique_commandes c ${JOINTURE_LIVRAISON} WHERE ${ou} LIMIT 1`, params);
  if (!c) return null;
  const lignes = await sql('SELECT * FROM boutique_commande_lignes WHERE commande_id = ? ORDER BY id', [c.id]);
  return {
    id: c.id,
    reference: c.reference,
    code: c.code,
    type: c.type,
    statut: c.statut_reel,
    mode_livraison: c.mode_livraison,
    adresse: c.adresse,
    frais_livraison: nombre(c.frais_livraison),
    a_payer: nombre(c.total_final) + nombre(c.frais_livraison),
    motif: c.motif_reel,
    livreur: c.livreur || null,
    date_livraison: c.date_livraison || null,
    livraison_numero: c.livraison_numero || null,
    livraison_id: c.livraison_id || null,
    compte_client_id: c.compte_client_id,
    client_nom: c.client_nom,
    client_telephone: c.client_telephone,
    note_client: c.note_client,
    note_vendeur: c.note_vendeur,
    total_initial: nombre(c.total_initial),
    remise: nombre(c.remise),
    total_final: nombre(c.total_final),
    commande_speciale_id: c.commande_speciale_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    lignes: lignes.map((l) => ({
      id: l.id, source: l.source, produit_id: l.produit_id, special_id: l.special_id, nom: l.nom, image: l.image, taille: l.taille,
      quantite: l.quantite, prix_unitaire: nombre(l.prix_unitaire), prix_negocie: l.prix_negocie == null ? null : nombre(l.prix_negocie),
    })),
  };
}

// GET /api/boutique/commandes/:code  (lien envoyé sur WhatsApp — le client voit son prix à jour)
exports.voirCommande = async (req, res) => {
  try {
    const c = await chargerCommande('code = ?', [req.params.code]);
    if (!c) return res.status(404).json({ message: 'Commande introuvable. Vérifiez le lien reçu.' });
    delete c.id;
    delete c.compte_client_id;
    res.json(c);
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger la commande.', erreur: e.message });
  }
};

// ------------------------------------------------------------ VENDEUR (token Koloun Gestion)

// GET /api/boutique/admin/commandes?statut=
exports.listerCommandes = async (req, res) => {
  try {
    const params = [req.utilisateur.boutique_id];
    let filtre = '';
    if (req.query.statut === 'a_confirmer') filtre = ` AND (${STATUT_SQL}) IN ('nouvelle','en_discussion')`;
    else if (req.query.statut) { filtre = ` AND (${STATUT_SQL}) = ?`; params.push(req.query.statut); }
    const liste = await sql(
      `SELECT c.id, c.reference, c.code, c.type, ${STATUT_SQL} AS statut, c.mode_livraison, c.adresse, c.client_nom, c.client_telephone, c.total_initial, c.remise, c.total_final, c.created_at,
              (SELECT COUNT(*) FROM boutique_commande_lignes l WHERE l.commande_id = c.id) AS nb_lignes,
              (SELECT l.image FROM boutique_commande_lignes l WHERE l.commande_id = c.id ORDER BY l.id LIMIT 1) AS image
       FROM boutique_commandes c ${JOINTURE_LIVRAISON} WHERE c.boutique_id = ?${filtre} ORDER BY c.created_at DESC LIMIT 300`, params);
    res.json(liste.map((c) => ({ ...c, total_initial: nombre(c.total_initial), remise: nombre(c.remise), total_final: nombre(c.total_final), nb_lignes: Number(c.nb_lignes) })));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les commandes.', erreur: e.message });
  }
};

// GET /api/boutique/admin/commandes/:id
exports.obtenirCommande = async (req, res) => {
  try {
    // ?par=code : ouvrir la commande depuis le lien envoyé au client
    const champ = req.query.par === 'code' ? 'code' : 'id';
    const c = await chargerCommande(`${champ} = ? AND boutique_id = ?`, [req.params.id, req.utilisateur.boutique_id]);
    if (!c) return res.status(404).json({ message: 'Commande introuvable.' });
    res.json(c);
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger la commande.', erreur: e.message });
  }
};

// PATCH /api/boutique/admin/commandes/:id
// { lignes: [{ id, prix_negocie }], remise, note_vendeur, statut }
// Réduction uniquement : un prix négocié ne peut pas dépasser le prix affiché.
exports.modifierCommande = async (req, res) => {
  try {
    const c = await chargerCommande('id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!c) return res.status(404).json({ message: 'Commande introuvable.' });
    // Le prix peut changer jusqu'à la livraison (pas après : la vente et le reçu sont faits)
    if (['livree', 'annulee'].includes(c.statut)) return res.status(409).json({ message: c.statut === 'livree' ? 'Commande déjà livrée : le prix ne peut plus changer.' : 'Commande annulée.' });
    const ancienTotal = c.total_final;

    const nouvellesLignes = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    for (const nl of nouvellesLignes) {
      const ligne = c.lignes.find((l) => l.id === Number(nl.id));
      if (!ligne) continue;
      let prix = nl.prix_negocie === '' || nl.prix_negocie == null ? null : Math.round(Number(nl.prix_negocie));
      if (prix != null && (Number.isNaN(prix) || prix < 0)) return res.status(400).json({ message: `Prix invalide pour « ${ligne.nom} ».` });
      if (prix != null && prix > ligne.prix_unitaire) return res.status(400).json({ message: `« ${ligne.nom} » : le nouveau prix doit être inférieur ou égal à ${ligne.prix_unitaire.toLocaleString('fr-FR')} GNF.` });
      if (prix === ligne.prix_unitaire) prix = null;
      await exec('UPDATE boutique_commande_lignes SET prix_negocie = ? WHERE id = ?', [prix, ligne.id]);
      ligne.prix_negocie = prix;
    }

    const sousTotal = c.lignes.reduce((s, l) => s + (l.prix_negocie ?? l.prix_unitaire) * l.quantite, 0);
    let remise = req.body.remise !== undefined ? Math.round(Number(req.body.remise) || 0) : c.remise;
    remise = Math.min(Math.max(0, remise), sousTotal);
    const totalFinal = sousTotal - remise;

    // Le statut se change avec « Accepter » / « Refuser », puis dans la page Livraisons de Koloun Gestion
    const statut = (await sql('SELECT statut FROM boutique_commandes WHERE id = ?', [c.id]))[0].statut;
    const note = req.body.note_vendeur !== undefined ? (req.body.note_vendeur ? String(req.body.note_vendeur).slice(0, 500) : null) : c.note_vendeur;

    await exec(
      'UPDATE boutique_commandes SET remise = ?, total_final = ?, statut = ?, note_vendeur = ?, modifie_par = ? WHERE id = ?',
      [remise, totalFinal, statut, note, req.utilisateur.id, c.id]);
    // Déjà acceptée : la livraison encaisse le nouveau montant
    if (c.livraison_id) await exec('UPDATE livraisons SET montant_a_encaisser = ? WHERE id = ?', [totalFinal + c.frais_livraison, c.livraison_id]).catch(() => {});
    if (totalFinal !== ancienTotal && c.compte_client_id) chat.messagePrix(c.compte_client_id, c, ancienTotal, totalFinal, req.utilisateur.id).catch(() => {});

    // Commande spéciale validée → elle apparaît dans « Commandes spéciales » de Koloun Gestion, avec son lien de suivi
    if (statut === 'validee' && !c.commande_speciale_id && c.lignes.some((l) => l.source === 'speciale')) {
      const speciales = c.lignes.filter((l) => l.source === 'speciale');
      const prixSpeciales = speciales.reduce((s, l) => s + (l.prix_negocie ?? l.prix_unitaire) * l.quantite, 0);
      const part = sousTotal > 0 ? Math.round(prixSpeciales - (remise * prixSpeciales) / sousTotal) : prixSpeciales;
      const article = speciales.map((l) => `${l.nom}${l.taille ? ` (T.${l.taille})` : ''}${l.quantite > 1 ? ` x${l.quantite}` : ''}`).join(', ').slice(0, 200);
      const codeSuivi = crypto.randomBytes(5).toString('hex');
      const livraison = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
      const [csId] = await sequelize.query(
        `INSERT INTO commandes_speciales (boutique_id, client_nom, client_telephone, article, details, image, prix_total, date_livraison_prevue, statut, observation, code_suivi)
         VALUES (?,?,?,?,?,?,?,?, 'en_attente', ?, ?)`,
        { type: sequelize.QueryTypes.INSERT, replacements: [req.utilisateur.boutique_id, c.client_nom, c.client_telephone, article, `Commande en ligne ${c.reference}`, (speciales[0].image || '').slice(0, 255) || null, part, livraison, `Koloun Boutique ${c.reference}`, codeSuivi] });
      await exec("INSERT INTO suivi_commandes_speciales (commande_speciale_id, statut, note) VALUES (?, 'en_attente', 'Commande validée depuis Koloun Boutique')", [csId]).catch(() => {});
      await exec('UPDATE boutique_commandes SET commande_speciale_id = ? WHERE id = ?', [csId, c.id]);
    }

    res.json(await chargerCommande('id = ?', [c.id]));
  } catch (e) {
    res.status(500).json({ message: "La modification n'a pas pu être enregistrée.", erreur: e.message });
  }
};

// GET /api/boutique/admin/speciales (y compris celles retirées)
exports.listerSpecialesAdmin = async (req, res) => {
  try {
    const liste = await sql('SELECT * FROM catalogue_special WHERE boutique_id = ? ORDER BY actif DESC, created_at DESC', [req.utilisateur.boutique_id]);
    res.json(liste.map((s) => formaterSpecial(req, s)));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger le catalogue spécial.', erreur: e.message });
  }
};

// POST /api/boutique/admin/speciales  (multipart : images + nom, prix, description, tailles, delai)
exports.creerSpeciale = async (req, res) => {
  try {
    const { nom, prix, description, tailles, delai } = req.body;
    if (!nom || !(Number(prix) > 0)) return res.status(400).json({ message: 'Le nom et le prix sont obligatoires.' });
    const images = (req.files || []).map((f) => f.path);
    if (!images.length) return res.status(400).json({ message: 'Ajoutez au moins une photo.' });
    await exec(
      'INSERT INTO catalogue_special (boutique_id, nom, description, prix, images, tailles, delai) VALUES (?,?,?,?,?,?,?)',
      [req.utilisateur.boutique_id, String(nom).slice(0, 150), description || null, Math.round(Number(prix)), JSON.stringify(images), tailles || null, delai || '2 à 3 semaines']);
    res.status(201).json({ message: 'Paire publiée.' });
  } catch (e) {
    res.status(500).json({ message: "La paire n'a pas pu être publiée.", erreur: e.message });
  }
};

// PUT /api/boutique/admin/speciales/:id  (champs facultatifs ; nouvelles photos ajoutées ; images_conservees = JSON)
exports.modifierSpeciale = async (req, res) => {
  try {
    const [s] = await sql('SELECT * FROM catalogue_special WHERE id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!s) return res.status(404).json({ message: 'Paire introuvable.' });
    let images = [];
    try { images = JSON.parse(s.images || '[]'); } catch { images = []; }
    if (req.body.images_conservees) {
      const garder = JSON.parse(req.body.images_conservees);
      images = images.filter((chemin) => garder.some((url) => url === chemin || url.endsWith(chemin)));
    }
    images.push(...(req.files || []).map((f) => f.path));
    const b = req.body;
    await exec(
      'UPDATE catalogue_special SET nom = ?, description = ?, prix = ?, tailles = ?, delai = ?, actif = ?, images = ? WHERE id = ?',
      [b.nom ?? s.nom, b.description ?? s.description, b.prix != null ? Math.round(Number(b.prix)) : s.prix, b.tailles ?? s.tailles, b.delai ?? s.delai,
        b.actif != null ? (String(b.actif) === '1' || b.actif === true || b.actif === 'true' ? 1 : 0) : s.actif, JSON.stringify(images), s.id]);
    res.json({ message: 'Paire mise à jour.' });
  } catch (e) {
    res.status(500).json({ message: "La paire n'a pas pu être modifiée.", erreur: e.message });
  }
};

// DELETE /api/boutique/admin/speciales/:id → retirée de l'application (gardée pour l'historique des commandes)
exports.retirerSpeciale = async (req, res) => {
  try {
    await exec('UPDATE catalogue_special SET actif = 0 WHERE id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    res.json({ message: "Paire retirée de l'application." });
  } catch (e) {
    res.status(500).json({ message: "La paire n'a pas pu être retirée.", erreur: e.message });
  }
};

// GET /api/boutique/admin/produits → tous les produits avec catégorie et visibilité
exports.listerProduitsAdmin = async (req, res) => {
  try {
    const liste = await sql(
      `SELECT p.id, p.nom, p.prix_normal, p.categorie, COALESCE(p.visible_boutique,1) AS visible,
              (SELECT v.image FROM produit_variantes v WHERE v.produit_id = p.id ORDER BY v.id LIMIT 1) AS image
       FROM produits p WHERE p.boutique_id = ? ORDER BY p.created_at DESC`, [req.utilisateur.boutique_id]);
    res.json(liste.map((p) => ({ ...p, prix: nombre(p.prix_normal), visible: !!Number(p.visible), image: urlImage(req, p.image) })));
  } catch (e) {
    res.status(500).json({ message: 'Impossible de charger les produits.', erreur: e.message });
  }
};

// PATCH /api/boutique/admin/produits/:id { categorie, visible }
exports.reglerProduit = async (req, res) => {
  try {
    const champs = [];
    const valeurs = [];
    if (req.body.categorie !== undefined) { champs.push('categorie = ?'); valeurs.push(req.body.categorie ? String(req.body.categorie).trim().slice(0, 80) : null); }
    if (req.body.visible !== undefined) { champs.push('visible_boutique = ?'); valeurs.push(req.body.visible ? 1 : 0); }
    if (!champs.length) return res.json({ message: 'Rien à modifier.' });
    await exec(`UPDATE produits SET ${champs.join(', ')} WHERE id = ? AND boutique_id = ?`, [...valeurs, req.params.id, req.utilisateur.boutique_id]);
    res.json({ message: 'Produit mis à jour.' });
  } catch (e) {
    res.status(500).json({ message: "Le produit n'a pas pu être modifié.", erreur: e.message });
  }
};


// ------------------------------------------------------------ CIRCUIT COMMANDE → LIVRAISON

const nouvelleErreur = (code, message) => Object.assign(new Error(message), { code });
const repondre = (res, e, defaut) => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code ? e.message : defaut, erreur: e.code ? undefined : e.message });
const jourValide = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(j || '') ? j : new Date().toISOString().slice(0, 10));

// GET /api/boutique/admin/a-confirmer → commandes en attente, avec leurs articles (section « À confirmer » de Livraisons)
exports.aConfirmer = async (req, res) => {
  try {
    const ids = await sql(
      `SELECT c.id FROM boutique_commandes c ${JOINTURE_LIVRAISON}
       WHERE c.boutique_id = ? AND (${STATUT_SQL}) IN ('nouvelle','en_discussion') ORDER BY c.created_at ASC LIMIT 100`, [req.utilisateur.boutique_id]);
    const liste = [];
    for (const { id } of ids) liste.push(await chargerCommande('id = ?', [id]));
    res.json(liste);
  } catch (e) { repondre(res, e, 'Impossible de charger les commandes à confirmer.'); }
};

// POST /api/boutique/admin/commandes/:id/accepter { frais_livraison, livreur, date_livraison, remise }
// → la commande devient une livraison dans Koloun Gestion ; le client la voit « Expédiée » (ou « Prête » pour un retrait)
exports.accepter = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const c = await chargerCommande('id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!c) throw nouvelleErreur(404, 'Commande introuvable.');
    if (!['nouvelle', 'en_discussion'].includes(c.statut)) throw nouvelleErreur(409, 'Cette commande a déjà été traitée.');

    const sousTotal = c.lignes.reduce((s, l) => s + (l.prix_negocie ?? l.prix_unitaire) * l.quantite, 0);
    const remise = req.body.remise !== undefined && req.body.remise !== '' ? Math.min(Math.max(0, Math.round(Number(req.body.remise) || 0)), sousTotal) : c.remise;
    const totalFinal = sousTotal - remise;
    const frais = c.mode_livraison === 'retrait' ? 0 : Math.max(0, Math.round(Number(req.body.frais_livraison) || 0));
    const date = jourValide(req.body.date_livraison);
    const boutique_id = req.utilisateur.boutique_id;

    const prefixe = `LIV-${date.replace(/-/g, '')}-`;
    const nb = await Livraison.count({ where: { boutique_id, numero: { [require('sequelize').Op.like]: `${prefixe}%` } }, transaction: t });
    const articles = c.lignes.map((l) => ({ designation: `${l.nom}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`.slice(0, 200), taille: l.taille ? String(l.taille).slice(0, 30) : null, image: l.image }));
    const livraison = await Livraison.create({
      boutique_id,
      numero: `${prefixe}${String(nb + 1).padStart(3, '0')}`,
      date_livraison: date,
      client_nom: c.client_nom,
      client_telephone: c.client_telephone,
      adresse: c.mode_livraison === 'retrait' ? 'Retrait en boutique (Lambanyi)' : c.adresse,
      article: articles.map((a) => a.designation).join(' + ').slice(0, 200),
      taille: articles.map((a) => a.taille).filter(Boolean).join(', ').slice(0, 30) || null,
      image: articles.find((a) => a.image)?.image || null,
      montant_livraison: frais,
      montant_a_encaisser: totalFinal + frais,
      livreur: req.body.livreur ? String(req.body.livreur).slice(0, 100) : null,
      note: `Commande en ligne ${c.reference}${c.note_client ? ` — ${c.note_client}` : ''}`.slice(0, 255),
      cree_par: req.utilisateur.id,
    }, { transaction: t });
    await LivraisonArticle.bulkCreate(articles.map((a) => ({ ...a, livraison_id: livraison.id })), { transaction: t });
    await sequelize.query(
      "UPDATE boutique_commandes SET statut = 'validee', livraison_id = ?, frais_livraison = ?, remise = ?, total_final = ?, modifie_par = ? WHERE id = ?",
      { replacements: [livraison.id, frais, remise, totalFinal, req.utilisateur.id, c.id], transaction: t });
    await t.commit();

    if (c.compte_client_id) chat.messageSysteme(c.compte_client_id, `✅ Commande ${c.reference} confirmée par la boutique${c.mode_livraison === 'retrait' ? '' : ` · livraison prévue le ${new Date(date).toLocaleDateString('fr-FR')}`}.`).catch(() => {});
    Notification.create({ boutique_id, utilisateur_id: req.utilisateur.id, type: 'livraison_nouvelle',
      message: `Commande en ligne ${c.reference} acceptée → livraison ${livraison.numero} pour ${c.client_nom}.`.slice(0, 255) }).catch(() => {});
    res.json(await chargerCommande('id = ?', [c.id]));
  } catch (e) {
    await t.rollback().catch(() => {});
    repondre(res, e, "La commande n'a pas pu être acceptée.");
  }
};

// POST /api/boutique/admin/commandes/:id/refuser { motif }
exports.refuser = async (req, res) => {
  try {
    const motif = String(req.body.motif || '').trim();
    if (!motif) throw nouvelleErreur(400, 'Indiquez le motif du refus : le client le verra.');
    const c = await chargerCommande('id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!c) throw nouvelleErreur(404, 'Commande introuvable.');
    if (!['nouvelle', 'en_discussion'].includes(c.statut)) throw nouvelleErreur(409, 'Cette commande a déjà été traitée.');
    await exec("UPDATE boutique_commandes SET statut = 'annulee', motif = ?, modifie_par = ? WHERE id = ?", [motif.slice(0, 255), req.utilisateur.id, c.id]);
    if (c.compte_client_id) chat.messageSysteme(c.compte_client_id, `❌ Commande ${c.reference} refusée : ${motif.slice(0, 200)}`).catch(() => {});
    res.json(await chargerCommande('id = ?', [c.id]));
  } catch (e) { repondre(res, e, "La commande n'a pas pu être refusée."); }
};

// POST /api/boutique/compte/commandes/:code/annuler → le client annule tant que la boutique n'a pas accepté
exports.annulerParClient = async (req, res) => {
  try {
    const c = await chargerCommande('code = ?', [req.params.code]);
    if (!c || c.compte_client_id !== req.compte.compte_id) throw nouvelleErreur(404, 'Commande introuvable.');
    if (!['nouvelle', 'en_discussion'].includes(c.statut)) throw nouvelleErreur(409, 'La boutique a déjà accepté cette commande : écrivez-lui avec « Discuter ».');
    await exec("UPDATE boutique_commandes SET statut = 'annulee', motif = 'Annulée par le client' WHERE id = ?", [c.id]);
    Notification.create({ boutique_id: BOUTIQUE_ID, type: 'commande_boutique', message: `Commande en ligne ${c.reference} annulée par ${c.client_nom}.`.slice(0, 255) }).catch(() => {});
    const maj = await chargerCommande('id = ?', [c.id]);
    delete maj.id;
    delete maj.compte_client_id;
    res.json(maj);
  } catch (e) { repondre(res, e, "La commande n'a pas pu être annulée."); }
};
