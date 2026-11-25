// ============================================================
// DISCUSSION — routes du client (Koloun Boutique) et du vendeur (Koloun Gestion)
// ============================================================
const sequelize = require('../config/database');
const chat = require('../utils/chat');

const BOUTIQUE_ID = chat.BOUTIQUE_ID;
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (t, r = []) => sequelize.query(t, { ...SELECT, replacements: r });
const exec = (t, r = []) => sequelize.query(t, { replacements: r });
const erreur = (code, message) => Object.assign(new Error(message), { code });
const repondre = (res, e, defaut) => res.status(e.code && e.code < 500 ? e.code : 500).json({ message: e.code && e.code < 500 ? e.message : defaut, erreur: e.code && e.code < 500 ? undefined : e.message });

// Photo locale (/uploads/...) → adresse complète (l'application client est sur un autre domaine)
const urlImage = (req) => (chemin) => {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  return `${req.protocol}://${req.get('host')}${chemin.startsWith('/') ? '' : '/'}${chemin}`;
};

// Pas plus de 20 messages par minute et par client (anti-abus)
const compteurs = new Map();
function limiter(cle) {
  const now = Date.now();
  const l = (compteurs.get(cle) || []).filter((t) => now - t < 60000);
  if (l.length >= 20) throw erreur(429, 'Vous envoyez trop de messages. Patientez une minute.');
  l.push(now); compteurs.set(cle, l);
  if (compteurs.size > 5000) compteurs.clear();
}

// Contenu d'un nouveau message (commun client / vendeur). Les cartes produit et panier sont lues en base (prix exacts).
async function contenu(req) {
  const photo = req.file || (req.files || [])[0]; // l'envoi de fichiers range la photo dans req.files
  if (photo) return { type: 'image', donnees: { url: photo.path }, texte: String(req.body.texte || '').trim() || null };
  if (req.body.produit_id) {
    const [p] = await sql(`SELECT p.id, p.nom, p.prix_normal, (SELECT v.image FROM produit_variantes v WHERE v.produit_id = p.id ORDER BY v.id LIMIT 1) AS image
      FROM produits p WHERE p.id = ? AND p.boutique_id = ?`, [Number(req.body.produit_id), BOUTIQUE_ID]);
    if (!p) throw erreur(404, 'Article introuvable.');
    let taille = null; let image = p.image;
    if (req.body.produit_taille_id) {
      const [t] = await sql('SELECT t.taille, v.image FROM produit_tailles t JOIN produit_variantes v ON v.id = t.produit_variante_id WHERE t.id = ? AND v.produit_id = ?', [Number(req.body.produit_taille_id), p.id]);
      if (t) { taille = t.taille; image = t.image || image; }
    }
    return { type: 'produit', donnees: { produit_id: p.id, nom: p.nom, prix: Math.round(Number(p.prix_normal)), image, taille } };
  }
  if (req.body.panier) {
    let lignes = req.body.panier;
    if (typeof lignes === 'string') { try { lignes = JSON.parse(lignes); } catch { lignes = []; } }
    lignes = (Array.isArray(lignes) ? lignes : []).slice(0, 30);
    const ids = lignes.map((l) => Number(l.produit_taille_id)).filter(Boolean);
    if (!ids.length) throw erreur(400, 'Panier vide.');
    const infos = await sql(`SELECT t.id, t.taille, v.image, p.id AS produit_id, p.nom, p.prix_normal FROM produit_tailles t
      JOIN produit_variantes v ON v.id = t.produit_variante_id JOIN produits p ON p.id = v.produit_id WHERE t.id IN (${ids.join(',')}) AND p.boutique_id = ?`, [BOUTIQUE_ID]);
    const out = lignes.map((l) => { const x = infos.find((i) => i.id === Number(l.produit_taille_id)); return x && { produit_id: x.produit_id, nom: x.nom, taille: x.taille, image: x.image, prix: Math.round(Number(x.prix_normal)), quantite: Math.min(20, Math.max(1, Number(l.quantite) || 1)) }; }).filter(Boolean);
    if (!out.length) throw erreur(400, 'Panier vide.');
    return { type: 'panier', donnees: { lignes: out, total: out.reduce((s, l) => s + l.prix * l.quantite, 0) } };
  }
  const texte = String(req.body.texte || '').trim();
  if (!texte) throw erreur(400, 'Message vide.');
  return { type: 'texte', texte: texte.slice(0, 4000) };
}

// ------------------------------------------------------------ CLIENT (Koloun Boutique, compte obligatoire)

// GET /api/boutique/chat?apres=ID
exports.clientLire = async (req, res) => {
  try {
    const conv = await chat.conversationDuCompte(req.compte.compte_id);
    const messages = await chat.lireMessages(conv.id, { apres: Number(req.query.apres) || 0 });
    if (conv.non_lu_client) await exec('UPDATE chat_conversations SET non_lu_client = 0 WHERE id = ?', [conv.id]);
    res.json({ messages: await chat.enrichir(messages, urlImage(req)) });
  } catch (e) { repondre(res, e, 'Impossible de charger la discussion.'); }
};

// GET /api/boutique/chat/non-lus
exports.clientNonLus = async (req, res) => {
  try {
    const [c] = await sql('SELECT non_lu_client AS n FROM chat_conversations WHERE boutique_id = ? AND compte_client_id = ?', [BOUTIQUE_ID, req.compte.compte_id]);
    res.json({ n: Number(c?.n || 0) });
  } catch (e) { repondre(res, e, 'Erreur.'); }
};

// POST /api/boutique/chat  { texte } | { produit_id, produit_taille_id? } | { panier: [...] } | photo (champ « image »)
exports.clientEnvoyer = async (req, res) => {
  try {
    limiter(`c${req.compte.compte_id}`);
    const conv = await chat.conversationDuCompte(req.compte.compte_id);
    const m = await contenu(req);
    // Même article envoyé deux fois de suite (le client revient sur « Discuter ») : on ne le répète pas
    if (m.type === 'produit') {
      const [dernier] = await sql("SELECT type, donnees FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1", [conv.id]);
      if (dernier?.type === 'produit') {
        try { const d = JSON.parse(dernier.donnees); if (d.produit_id === m.donnees.produit_id && d.taille === m.donnees.taille) return res.json({ ok: true, deja: true }); } catch { /* ignoré */ }
      }
    }
    const id = await chat.ajouter(conv, { auteur: 'client', ...m });
    res.status(201).json({ id });
  } catch (e) { repondre(res, e, "Le message n'est pas parti. Réessayez."); }
};

// ------------------------------------------------------------ VENDEUR (Koloun Gestion)

// GET /api/chat?q=
exports.conversations = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const params = [req.utilisateur.boutique_id];
    let filtre = '';
    if (q) { filtre = ' AND (k.nom LIKE ? OR k.telephone LIKE ? OR k.email LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const l = await sql(`SELECT c.id, c.apercu, c.dernier_message_at, c.dernier_auteur, c.non_lu_vendeur, k.id AS compte_id, k.nom, k.telephone, k.photo
      FROM chat_conversations c JOIN comptes_clients k ON k.id = c.compte_client_id
      WHERE c.boutique_id = ? AND c.dernier_message_at IS NOT NULL${filtre} ORDER BY c.dernier_message_at DESC LIMIT 200`, params);
    res.json(l.map((x) => ({ ...x, non_lu_vendeur: Number(x.non_lu_vendeur) })));
  } catch (e) { repondre(res, e, 'Impossible de charger les messages.'); }
};

// GET /api/chat/non-lus
exports.nonLus = async (req, res) => {
  try {
    const [r] = await sql('SELECT COALESCE(SUM(non_lu_vendeur), 0) AS n, SUM(non_lu_vendeur > 0) AS conversations FROM chat_conversations WHERE boutique_id = ?', [req.utilisateur.boutique_id]);
    res.json({ n: Number(r.n || 0), conversations: Number(r.conversations || 0) });
  } catch (e) { repondre(res, e, 'Erreur.'); }
};

async function convVendeur(req) {
  const [c] = await sql(`SELECT c.*, k.nom, k.telephone, k.email, k.photo FROM chat_conversations c JOIN comptes_clients k ON k.id = c.compte_client_id
    WHERE c.id = ? AND c.boutique_id = ?`, [Number(req.params.id), req.utilisateur.boutique_id]);
  if (!c) throw erreur(404, 'Conversation introuvable.');
  return c;
}

// GET /api/chat/:id?apres=ID
exports.lire = async (req, res) => {
  try {
    const c = await convVendeur(req);
    const messages = await chat.lireMessages(c.id, { apres: Number(req.query.apres) || 0 });
    if (c.non_lu_vendeur) await exec('UPDATE chat_conversations SET non_lu_vendeur = 0 WHERE id = ?', [c.id]);
    res.json({
      client: { compte_id: c.compte_client_id, nom: c.nom, telephone: c.telephone, email: c.email, photo: c.photo },
      messages: await chat.enrichir(messages, urlImage(req)),
    });
  } catch (e) { repondre(res, e, 'Impossible de charger la discussion.'); }
};

// POST /api/chat/:id  { texte } | photo
exports.envoyer = async (req, res) => {
  try {
    const c = await convVendeur(req);
    const m = await contenu(req);
    const id = await chat.ajouter(c, { auteur: 'vendeur', utilisateur_id: req.utilisateur.id, ...m });
    res.status(201).json({ id });
  } catch (e) { repondre(res, e, "Le message n'est pas parti. Réessayez."); }
};

// ------------------------------------------------------------ DIRECT (Server-Sent Events)
// L'écran garde une connexion ouverte ; le serveur y pousse un signal dès qu'un message arrive.
// L'écran va alors chercher le message : il s'affiche en moins d'une seconde.
function ouvrirFlux(req, res, garder) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform', // no-transform : pas de compression (sinon le direct est retenu)
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const envoyer = (e) => { if (garder(e)) res.write(`data: ${JSON.stringify({ conversation_id: e.conversation_id, id: e.id, auteur: e.auteur })}\n\n`); };
  chat.bus.on('message', envoyer);
  const battement = setInterval(() => res.write(': ok\n\n'), 20000); // garde la connexion ouverte
  req.on('close', () => { clearInterval(battement); chat.bus.off('message', envoyer); });
}

// GET /api/boutique/chat/flux?token=…  (client)
exports.clientFlux = (req, res) => ouvrirFlux(req, res, (e) => e.compte_client_id === req.compte.compte_id && e.auteur !== 'client');

// GET /api/chat/flux?token=…  (Gestion)
exports.flux = (req, res) => ouvrirFlux(req, res, (e) => e.boutique_id === req.utilisateur.boutique_id);

// EventSource ne sait pas envoyer d'en-tête : le jeton passe dans l'adresse
exports.jetonDansAdresse = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) req.headers.authorization = `Bearer ${req.query.token}`;
  next();
};
