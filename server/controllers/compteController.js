// ============================================================
// KOLOUN BOUTIQUE — comptes des clients de l'application
//  - inscription (nom + téléphone ou email + mot de passe), connexion, connexion Google
//  - une seule porte de connexion : un compte Koloun Gestion (admin, vendeur) ouvre l'espace vendeur,
//    un compte client ouvre « Mon compte »
// Sécurité : les jetons clients sont signés avec une clé différente de Koloun Gestion,
// ils ne donnent donc JAMAIS accès aux pages de gestion.
// ============================================================
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const sequelize = require('../config/database');
const { Utilisateur, Role, Boutique } = require('../models');
const { trouverOuCreerClient } = require('../utils/clients');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const CLE_CLIENTS = () => `${process.env.JWT_SECRET}::koloun-boutique-clients`;
const SELECT = { type: sequelize.QueryTypes.SELECT };
// Même règle de statut que les commandes (la livraison dans Koloun Gestion fait foi)
const JOINTURE_LIVRAISON = 'LEFT JOIN livraisons lv ON lv.id = c.livraison_id';
const STATUT_SQL = `CASE WHEN c.livraison_id IS NOT NULL AND lv.id IS NULL THEN 'annulee'
  WHEN lv.statut = 'livree' THEN 'livree' WHEN lv.statut = 'annulee' THEN 'annulee'
  WHEN lv.statut = 'en_cours' THEN 'validee' ELSE c.statut END`;
const MOTIF_SQL_C = `COALESCE(lv.motif, CASE WHEN c.livraison_id IS NOT NULL AND lv.id IS NULL THEN 'Livraison supprimée par la boutique' END, c.motif)`;
const sql = (t, r = []) => sequelize.query(t, { ...SELECT, replacements: r });
const exec = (t, r = []) => sequelize.query(t, { replacements: r });

const erreur = (code, message) => Object.assign(new Error(message), { code });
const repondreErreur = (res, e, defaut) => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code ? e.message : defaut, erreur: e.code ? undefined : e.message });

// 620 00 00 00 / +224 620… → 224620000000
function normaliserTelephone(t) {
  let n = String(t || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9) n = `224${n}`;
  return n.length >= 8 ? n : null;
}
const estEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

function jetonClient(compte) {
  return jwt.sign({ compte_id: compte.id, type: 'client', boutique_id: compte.boutique_id }, CLE_CLIENTS(), { expiresIn: '180d' });
}

// Lit le jeton client (facultatif) d'une requête — utilisé aussi lors d'une commande
function lireCompte(req) {
  const t = (req.headers.authorization || '').split(' ')[1];
  if (!t) return null;
  try {
    const d = jwt.verify(t, CLE_CLIENTS());
    return d.type === 'client' ? d : null;
  } catch { return null; }
}
exports.lireCompte = lireCompte;

exports.exigerCompte = (req, res, next) => {
  const d = lireCompte(req);
  if (!d) return res.status(401).json({ message: 'Connectez-vous à votre compte.' });
  req.compte = d;
  next();
};

const publique = (c) => ({
  id: c.id, nom: c.nom, telephone: c.telephone, email: c.email, photo: c.photo,
  google: !!c.google_id, created_at: c.created_at,
});

// Limite les essais de mot de passe (par adresse IP)
const essais = new Map();
function limiter(req) {
  const ip = req.ip || 'inconnu';
  const t = Date.now();
  const liste = (essais.get(ip) || []).filter((x) => t - x < 15 * 60 * 1000);
  if (liste.length >= 12) throw erreur(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  liste.push(t);
  essais.set(ip, liste);
}

// Fiche client dans Koloun Gestion (même liste que la page « Clients »)
async function lierClientGestion(compte) {
  try {
    const client = await trouverOuCreerClient(compte.boutique_id, { nom: compte.nom, telephone: compte.telephone_saisi || compte.telephone });
    if (client) await exec('UPDATE comptes_clients SET client_id = ? WHERE id = ?', [client.id, compte.id]);
  } catch (e) { console.error('Liaison client Gestion :', e.message); }
}

// POST /api/boutique/auth/inscription { nom, contact, mot_de_passe, confirmation }
exports.inscription = async (req, res) => {
  try {
    limiter(req);
    const nom = String(req.body.nom || '').trim();
    const contact = String(req.body.contact || '').trim();
    const mdp = String(req.body.mot_de_passe || '');
    if (nom.length < 2) throw erreur(400, 'Indiquez votre nom.');
    const email = estEmail(contact) ? contact.toLowerCase() : null;
    const telephone = email ? null : normaliserTelephone(contact);
    if (!email && !telephone) throw erreur(400, 'Indiquez un numéro de téléphone ou une adresse email valide.');
    if (mdp.length < 6) throw erreur(400, 'Le mot de passe doit contenir au moins 6 caractères.');
    if (req.body.confirmation !== undefined && req.body.confirmation !== mdp) throw erreur(400, 'Les deux mots de passe ne sont pas identiques.');

    if (email) {
      const [personnel] = await sql('SELECT id FROM utilisateurs WHERE email = ?', [email]);
      if (personnel) throw erreur(409, 'Cet email appartient à un compte Koloun Gestion : utilisez « Se connecter ».');
    }
    const [existe] = await sql('SELECT id FROM comptes_clients WHERE boutique_id = ? AND (email = ? OR telephone = ?)', [BOUTIQUE_ID, email || '-', telephone || '-']);
    if (existe) throw erreur(409, `Un compte existe déjà avec ${email ? 'cet email' : 'ce numéro'}. Connectez-vous.`);

    const hache = await bcrypt.hash(mdp, 10);
    const [id] = await sequelize.query(
      'INSERT INTO comptes_clients (boutique_id, nom, telephone, email, mot_de_passe, derniere_connexion) VALUES (?,?,?,?,?, NOW())',
      { type: sequelize.QueryTypes.INSERT, replacements: [BOUTIQUE_ID, nom.slice(0, 150), telephone, email, hache] });
    const [compte] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [id]);
    await lierClientGestion({ ...compte, telephone_saisi: telephone ? contact : null });
    res.status(201).json({ type: 'client', token: jetonClient(compte), compte: publique(compte) });
  } catch (e) { repondreErreur(res, e, "L'inscription n'a pas abouti."); }
};

// POST /api/boutique/auth/connexion { identifiant, mot_de_passe }
exports.connexion = async (req, res) => {
  try {
    limiter(req);
    const identifiant = String(req.body.identifiant || '').trim();
    const mdp = String(req.body.mot_de_passe || '');
    if (!identifiant || !mdp) throw erreur(400, 'Indiquez votre identifiant et votre mot de passe.');

    // 1. Compte Koloun Gestion (admin / vendeur) → espace vendeur
    if (estEmail(identifiant)) {
      const u = await Utilisateur.findOne({ where: { email: identifiant.toLowerCase() }, include: [{ model: Role }, { model: Boutique }] })
        || await Utilisateur.findOne({ where: { email: identifiant }, include: [{ model: Role }, { model: Boutique }] });
      if (u && await bcrypt.compare(mdp, u.mot_de_passe)) {
        if (!u.actif) throw erreur(403, 'Ce compte a été désactivé.');
        const token = jwt.sign({ id: u.id, role: u.Role.nom, boutique_id: u.boutique_id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
        Utilisateur.update({ derniere_connexion: new Date() }, { where: { id: u.id } }).catch(() => {});
        return res.json({
          type: 'vendeur',
          token,
          utilisateur: { id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, role: u.Role.nom, boutique: u.Boutique?.nom, boutique_id: u.boutique_id },
        });
      }
    }

    // 2. Compte client
    const email = estEmail(identifiant) ? identifiant.toLowerCase() : null;
    const telephone = email ? null : normaliserTelephone(identifiant);
    const [compte] = await sql('SELECT * FROM comptes_clients WHERE boutique_id = ? AND (email = ? OR telephone = ?)', [BOUTIQUE_ID, email || '-', telephone || '-']);
    if (!compte) throw erreur(401, 'Identifiant ou mot de passe incorrect.');
    if (!compte.mot_de_passe) throw erreur(401, 'Ce compte a été créé avec Google : utilisez « Continuer avec Google ».');
    if (!compte.actif) throw erreur(403, 'Ce compte a été désactivé. Contactez la boutique.');
    if (!(await bcrypt.compare(mdp, compte.mot_de_passe))) throw erreur(401, 'Identifiant ou mot de passe incorrect.');
    exec('UPDATE comptes_clients SET derniere_connexion = NOW() WHERE id = ?', [compte.id]).catch(() => {});
    res.json({ type: 'client', token: jetonClient(compte), compte: publique(compte) });
  } catch (e) { repondreErreur(res, e, 'La connexion a échoué.'); }
};

// Vérifie le jeton Google auprès de Google (pas de dépendance supplémentaire)
function verifierJetonGoogle(credential) {
  return new Promise((resolve, reject) => {
    https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, (r) => {
      let corps = '';
      r.on('data', (c) => { corps += c; });
      r.on('end', () => {
        try {
          const d = JSON.parse(corps);
          if (r.statusCode !== 200 || d.error) return reject(erreur(401, 'Connexion Google refusée.'));
          resolve(d);
        } catch { reject(erreur(401, 'Connexion Google refusée.')); }
      });
    }).on('error', () => reject(erreur(502, 'Google ne répond pas. Réessayez.')));
  });
}

// Connexion / inscription avec un jeton Google déjà vérifié → { type, token, compte }
async function connecterParGoogle(d) {
  if (d.aud !== process.env.GOOGLE_CLIENT_ID) throw erreur(401, 'Connexion Google refusée.');
  if (String(d.email_verified) !== 'true') throw erreur(401, 'Votre email Google doit être vérifié.');
  const email = String(d.email).toLowerCase();

  let [compte] = await sql('SELECT * FROM comptes_clients WHERE boutique_id = ? AND (google_id = ? OR email = ?)', [BOUTIQUE_ID, d.sub, email]);
  if (compte) {
    if (!compte.actif) throw erreur(403, 'Ce compte a été désactivé. Contactez la boutique.');
    await exec('UPDATE comptes_clients SET google_id = ?, photo = COALESCE(photo, ?), derniere_connexion = NOW() WHERE id = ?', [d.sub, d.picture || null, compte.id]);
  } else {
    const [id] = await sequelize.query(
      'INSERT INTO comptes_clients (boutique_id, nom, email, google_id, photo, derniere_connexion) VALUES (?,?,?,?,?, NOW())',
      { type: sequelize.QueryTypes.INSERT, replacements: [BOUTIQUE_ID, String(d.name || email.split('@')[0]).slice(0, 150), email, d.sub, d.picture || null] });
    [compte] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [id]);
  }
  if (!compte.client_id) await lierClientGestion(compte); // fiche dans « Clients » de Koloun Gestion, comme une inscription classique
  [compte] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [compte.id]);
  return { type: 'client', token: jetonClient(compte), compte: publique(compte) };
}

// POST /api/boutique/auth/google { credential }  — fenêtre Google (Android, ordinateur, navigateur)
exports.google = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) throw erreur(503, "La connexion Google n'est pas encore activée.");
    const d = await verifierJetonGoogle(String(req.body.credential || ''));
    res.json(await connecterParGoogle(d));
  } catch (e) { repondreErreur(res, e, 'La connexion Google a échoué.'); }
};

// ---------- iPhone (application installée) : connexion Google par redirection ----------
// Sur iPhone, la fenêtre Google ne fonctionne qu'une fois dans une application installée.
// 1) l'application prépare un code secret (nonce) et l'adresse où revenir ;
// 2) Google renvoie l'identité au serveur (POST credential), le jeton contient ce code ;
// 3) le serveur garde la connexion sous ce code, l'application la récupère (une seule fois).
const attentesGoogle = new Map(); // nonce → { origine, t, resultat? }
const DUREE_ATTENTE = 15 * 60 * 1000;
function nettoyerAttentes() {
  const limite = Date.now() - DUREE_ATTENTE;
  for (const [k, v] of attentesGoogle) if (v.t < limite) attentesGoogle.delete(k);
}
const nonceValide = (n) => typeof n === 'string' && /^[A-Za-z0-9_-]{24,100}$/.test(n);

// POST /api/boutique/auth/google/preparer { nonce, origine }
exports.preparerGoogle = (req, res) => {
  nettoyerAttentes();
  const { nonce, origine } = req.body || {};
  let url;
  try { url = new URL(String(origine)); } catch { url = null; }
  const origineOk = url && (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (!nonceValide(nonce) || !origineOk) return res.status(400).json({ message: 'Demande invalide.' });
  if (attentesGoogle.size > 5000) return res.status(429).json({ message: 'Réessayez dans quelques minutes.' });
  if (!attentesGoogle.has(nonce)) attentesGoogle.set(nonce, { origine: url.origin, t: Date.now() });
  res.json({ ok: true });
};

// POST /api/boutique/auth/google/retour  (formulaire envoyé par Google : credential)
exports.retourGoogle = async (req, res) => {
  let attente = null;
  try {
    if (!process.env.GOOGLE_CLIENT_ID) throw erreur(503, "La connexion Google n'est pas encore activée.");
    // Protection Google (double envoi) : si le cookie est présent, il doit correspondre
    const cookieCsrf = (String(req.headers.cookie || '').match(/(?:^|;\s*)g_csrf_token=([^;]+)/) || [])[1];
    if (cookieCsrf && req.body.g_csrf_token && cookieCsrf !== req.body.g_csrf_token) throw erreur(400, 'Connexion Google refusée.');
    const d = await verifierJetonGoogle(String(req.body.credential || ''));
    attente = d.nonce && attentesGoogle.get(d.nonce);
    if (!attente) throw erreur(400, 'La connexion a expiré. Réessayez.');
    attente.resultat = await connecterParGoogle(d);
    attente.t = Date.now();
    res.redirect(303, `${attente.origine}/connexion-google?n=${encodeURIComponent(d.nonce)}`);
  } catch (e) {
    const message = e.code && e.code < 500 ? e.message : 'La connexion Google a échoué.';
    const origine = attente?.origine || process.env.BOUTIQUE_URL;
    if (origine) return res.redirect(303, `${origine}/connexion-google?erreur=${encodeURIComponent(message)}`);
    res.status(e.code || 500).send(message);
  }
};

// GET /api/boutique/auth/google/attente/:nonce → la connexion, une seule fois (404 tant qu'elle n'est pas prête)
exports.attenteGoogle = (req, res) => {
  const a = attentesGoogle.get(req.params.nonce);
  if (!a || !a.resultat) return res.status(404).json({ message: 'En attente.' });
  attentesGoogle.delete(req.params.nonce);
  res.json(a.resultat);
};

// GET /api/boutique/compte → profil + commandes passées depuis ce compte
exports.monCompte = async (req, res) => {
  try {
    const [c] = await sql('SELECT * FROM comptes_clients WHERE id = ? AND actif = 1', [req.compte.compte_id]);
    if (!c) return res.status(401).json({ message: 'Compte introuvable. Reconnectez-vous.' });
    const commandes = await sql(
      `SELECT c.reference, c.code, ${STATUT_SQL} AS statut, c.mode_livraison, ${MOTIF_SQL_C} AS motif, c.frais_livraison, c.total_initial, c.total_final, c.created_at,
              (SELECT COALESCE(SUM(l.quantite),0) FROM boutique_commande_lignes l WHERE l.commande_id = c.id) AS nb,
              (SELECT l.image FROM boutique_commande_lignes l WHERE l.commande_id = c.id ORDER BY l.id LIMIT 1) AS image
       FROM boutique_commandes c ${JOINTURE_LIVRAISON} WHERE c.compte_client_id = ? ORDER BY c.created_at DESC LIMIT 100`, [c.id]);
    const { reservationsDuCompte } = require('./reservationClientController'); // chargé ici (évite une boucle d'import)
    const reservations = await reservationsDuCompte(c.id).catch(() => []);
    res.json({ compte: publique(c), reservations, commandes: commandes.map((x) => ({ ...x, nb: Number(x.nb), total: Math.round(Number(x.total_final)), frais_livraison: Math.round(Number(x.frais_livraison)), total_initial: Math.round(Number(x.total_initial)), date: x.created_at })) });
  } catch (e) { repondreErreur(res, e, 'Impossible de charger votre compte.'); }
};

// PUT /api/boutique/compte { nom, telephone } — et mot de passe : { ancien, nouveau }
exports.modifierCompte = async (req, res) => {
  try {
    const [c] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [req.compte.compte_id]);
    if (!c) throw erreur(401, 'Compte introuvable.');
    const nom = req.body.nom !== undefined ? String(req.body.nom).trim() : c.nom;
    if (nom.length < 2) throw erreur(400, 'Indiquez votre nom.');
    let telephone = c.telephone;
    if (req.body.telephone !== undefined && req.body.telephone !== '') {
      telephone = normaliserTelephone(req.body.telephone);
      if (!telephone) throw erreur(400, 'Numéro de téléphone invalide.');
      const [pris] = await sql('SELECT id FROM comptes_clients WHERE boutique_id = ? AND telephone = ? AND id <> ?', [c.boutique_id, telephone, c.id]);
      if (pris) throw erreur(409, 'Ce numéro est déjà utilisé par un autre compte.');
    }
    let hache = c.mot_de_passe;
    if (req.body.nouveau) {
      if (String(req.body.nouveau).length < 6) throw erreur(400, 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
      if (c.mot_de_passe && !(await bcrypt.compare(String(req.body.ancien || ''), c.mot_de_passe))) throw erreur(400, 'Mot de passe actuel incorrect.');
      hache = await bcrypt.hash(String(req.body.nouveau), 10);
    }
    await exec('UPDATE comptes_clients SET nom = ?, telephone = ?, mot_de_passe = ? WHERE id = ?', [nom.slice(0, 150), telephone, hache, c.id]);
    const [maj] = await sql('SELECT * FROM comptes_clients WHERE id = ?', [c.id]);
    if (!c.client_id || telephone !== c.telephone) await lierClientGestion({ ...maj, telephone_saisi: req.body.telephone || maj.telephone });
    res.json({ compte: publique(maj) });
  } catch (e) { repondreErreur(res, e, "La modification n'a pas abouti."); }
};

// ------------------------------------------------------------ ADMIN (Koloun Gestion, rôle admin)

// GET /api/boutique/admin/clients → les clients inscrits sur l'application de la boutique
exports.listerClients = async (req, res) => {
  try {
    const liste = await sql(
      `SELECT cc.id, cc.nom, cc.telephone, cc.email, cc.photo, cc.actif, cc.created_at, cc.derniere_connexion,
              (cc.google_id IS NOT NULL) AS google, (cc.mot_de_passe IS NOT NULL) AS avec_mdp,
              COUNT(c.id) AS nb_commandes, COALESCE(SUM(CASE WHEN c.statut IN ('validee','livree') THEN c.total_final ELSE 0 END),0) AS total_confirme,
              MAX(c.created_at) AS derniere_commande
       FROM comptes_clients cc LEFT JOIN boutique_commandes c ON c.compte_client_id = cc.id
       WHERE cc.boutique_id = ? GROUP BY cc.id ORDER BY cc.created_at DESC`, [req.utilisateur.boutique_id]);
    res.json(liste.map((x) => ({ ...x, google: !!Number(x.google), avec_mdp: !!Number(x.avec_mdp), actif: !!Number(x.actif), nb_commandes: Number(x.nb_commandes), total_confirme: Math.round(Number(x.total_confirme)) })));
  } catch (e) { repondreErreur(res, e, 'Impossible de charger les clients.'); }
};

// GET /api/boutique/admin/clients/:id/commandes
exports.commandesClient = async (req, res) => {
  try {
    const liste = await sql(
      `SELECT c.id, c.reference, c.code, ${STATUT_SQL} AS statut, c.total_final, c.created_at FROM boutique_commandes c
       JOIN comptes_clients cc ON cc.id = c.compte_client_id ${JOINTURE_LIVRAISON}
       WHERE cc.id = ? AND cc.boutique_id = ? ORDER BY c.created_at DESC`, [req.params.id, req.utilisateur.boutique_id]);
    res.json(liste.map((x) => ({ ...x, total_final: Math.round(Number(x.total_final)) })));
  } catch (e) { repondreErreur(res, e, 'Impossible de charger les commandes.'); }
};

// PATCH /api/boutique/admin/clients/:id { actif }  ·  POST …/:id/reinitialiser → nouveau mot de passe provisoire
exports.reglerClient = async (req, res) => {
  try {
    await exec('UPDATE comptes_clients SET actif = ? WHERE id = ? AND boutique_id = ?', [req.body.actif ? 1 : 0, req.params.id, req.utilisateur.boutique_id]);
    res.json({ message: req.body.actif ? 'Compte réactivé.' : 'Compte désactivé.' });
  } catch (e) { repondreErreur(res, e, "La modification n'a pas abouti."); }
};

exports.reinitialiserMotDePasse = async (req, res) => {
  try {
    const [c] = await sql('SELECT id FROM comptes_clients WHERE id = ? AND boutique_id = ?', [req.params.id, req.utilisateur.boutique_id]);
    if (!c) throw erreur(404, 'Client introuvable.');
    const provisoire = `KL${crypto.randomInt(100000, 999999)}`;
    await exec('UPDATE comptes_clients SET mot_de_passe = ? WHERE id = ?', [await bcrypt.hash(provisoire, 10), c.id]);
    res.json({ mot_de_passe: provisoire });
  } catch (e) { repondreErreur(res, e, 'La réinitialisation a échoué.'); }
};

// Utilisés par les réservations en ligne (reservationClientController)
exports.normaliserTelephone = normaliserTelephone;
exports.publique = publique;
exports.lierClientGestion = lierClientGestion;
