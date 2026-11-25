// ============================================================
// AGENT IA KOLOUN LUXURE — le vendeur virtuel (WhatsApp, Messenger, test dans Gestion)
// Il ne touche jamais directement la base : il passe par des OUTILS précis, programmés ici.
//  - lecture : articles en stock (prix, tailles, photos, lien), commandes spéciales, suivi de commande
//  - réduction : 10 % maximum (AGENT_REMISE_MAX), vérifiée par le serveur, jamais par l'IA seule
//  - commande : il ne la crée pas, il la TRANSMET au vendeur (Gestion → « Agent IA » + notification)
//  - il passe la main à un humain quand il ne sait pas, ou quand le client le demande
// Coût maîtrisé : modèle économique (Claude Haiku), plafond mensuel (AGENT_BUDGET_MOIS, 10 $ par défaut).
// ============================================================
const sequelize = require('../config/database');
const { Notification } = require('../models');
const { JOINTURE_LIVRAISON, STATUT_SQL } = require('../controllers/boutiqueController');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const SELECT = { type: sequelize.QueryTypes.SELECT };
const sql = (texte, r = [], t) => sequelize.query(texte, { ...SELECT, replacements: r, transaction: t });
const exec = (texte, r = [], t) => sequelize.query(texte, { replacements: r, transaction: t });

const MODELE = process.env.AGENT_MODELE || 'claude-haiku-5-5';
const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const REMISE_MAX = Math.min(50, Math.max(0, Number(process.env.AGENT_REMISE_MAX ?? 10))); // en %
const BUDGET_MOIS = Number(process.env.AGENT_BUDGET_MOIS ?? 10); // en dollars
// Prix du modèle (dollars par million de jetons) — à ajuster si le modèle change
const PRIX_ENTREE = Number(process.env.AGENT_PRIX_ENTREE ?? 0.10);
const PRIX_SORTIE = Number(process.env.AGENT_PRIX_SORTIE ?? 0.50);
const SITE = () => (process.env.BOUTIQUE_URL || 'https://www.kolounluxure.com').replace(/\/$/, '');
const API_PUBLIQUE = () => (process.env.API_PUBLIQUE_URL || 'https://koloun-gestion-1.onrender.com').replace(/\/$/, '');

const actif = () => !!process.env.ANTHROPIC_API_KEY;
const nombre = (v) => Math.round(Number(v || 0));
const gnf = (n) => `${nombre(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} GNF`;
const image = (c) => (!c ? null : /^https?:\/\//.test(c) ? c : `${API_PUBLIQUE()}${c.startsWith('/') ? '' : '/'}${c}`);
const prixPlancher = (prix) => Math.ceil((nombre(prix) * (100 - REMISE_MAX)) / 100 / 500) * 500; // arrondi à 500 GNF au-dessus

// ---------------------------------------------------------------- Lecture du stock (même règle que le site)
async function articles({ recherche, categorie, taille, prix_max, ids } = {}) {
  const r = [BOUTIQUE_ID]; let filtre = '';
  if (ids?.length) { filtre += ` AND p.id IN (${ids.map(Number).filter(Boolean).join(',') || 0})`; }
  if (recherche) {
    const mots = String(recherche).toLowerCase().split(/\s+/).filter((m) => m.length > 1).slice(0, 5)
      .map((m) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m)); // « baskets » trouve « Basket »
    mots.forEach((m) => { filtre += ' AND (LOWER(p.nom) LIKE ? OR LOWER(COALESCE(p.description,\'\')) LIKE ? OR LOWER(COALESCE(p.categorie,\'\')) LIKE ?)'; r.push(`%${m}%`, `%${m}%`, `%${m}%`); });
  }
  if (categorie) { filtre += ' AND LOWER(p.categorie) LIKE ?'; r.push(`%${String(categorie).toLowerCase()}%`); }
  if (prix_max) { filtre += ' AND p.prix_normal <= ?'; r.push(Number(prix_max)); }
  const lignes = await sql(`
    SELECT p.id, p.nom, p.prix_normal, p.description, p.categorie, v.id AS vid, v.image, t.taille, t.quantite
    FROM produits p
    LEFT JOIN produit_variantes v ON v.produit_id = p.id
    LEFT JOIN produit_tailles t ON t.produit_variante_id = v.id
    WHERE p.boutique_id = ? AND COALESCE(p.visible_boutique, 1) = 1 ${filtre}
    ORDER BY p.created_at DESC, v.id, t.id LIMIT 600`, r);
  const parId = new Map();
  for (const l of lignes) {
    if (!parId.has(l.id)) parId.set(l.id, { id: l.id, nom: l.nom, prix: nombre(l.prix_normal), categorie: l.categorie, description: (l.description || '').slice(0, 200), modeles: [] });
    const a = parId.get(l.id);
    if (!l.vid) continue;
    let m = a.modeles.find((x) => x.vid === l.vid);
    if (!m) { m = { vid: l.vid, photo: image(l.image), tailles: [] }; a.modeles.push(m); }
    if (l.taille && Number(l.quantite) > 0) m.tailles.push({ taille: l.taille, stock: Number(l.quantite) });
  }
  let liste = [...parId.values()].filter((a) => a.modeles.some((m) => m.tailles.length));
  if (taille) liste = liste.filter((a) => a.modeles.some((m) => m.tailles.some((t) => String(t.taille).toLowerCase() === String(taille).toLowerCase())));
  return liste;
}

const resumeArticle = (a) => ({
  id: a.id,
  nom: a.nom,
  prix: gnf(a.prix),
  prix_minimum_negociable: gnf(prixPlancher(a.prix)),
  categorie: a.categorie || undefined,
  modeles: a.modeles.map((m, i) => ({ modele: i + 1, tailles_disponibles: m.tailles.map((t) => `${t.taille} (${t.stock})`).join(', ') || 'épuisé' })),
  lien: `${SITE()}/article/${a.id}`,
});

// ---------------------------------------------------------------- Les outils de l'agent
const OUTILS = [
  {
    name: 'chercher_articles',
    description: "Cherche les articles EN STOCK de Koloun Luxure (vêtements, chaussures, sacs…). Renvoie nom, prix, tailles disponibles par modèle (photo) avec quantité, et le lien de la page. Utilise-le avant de parler d'un article, d'un prix ou d'une taille.",
    input_schema: {
      type: 'object',
      properties: {
        recherche: { type: 'string', description: 'Mots-clés : « basket blanche », « robe », « air force »…' },
        categorie: { type: 'string' },
        taille: { type: 'string', description: 'Ne garder que les articles disponibles dans cette taille' },
        prix_max: { type: 'number', description: 'Budget maximum en GNF' },
      },
    },
  },
  {
    name: 'envoyer_photos',
    description: "Envoie au client les photos d'un article (une par modèle, 4 au maximum). Préfère envoyer le lien de l'article quand il y a beaucoup de modèles.",
    input_schema: {
      type: 'object',
      properties: { article_id: { type: 'integer' }, modele: { type: 'integer', description: 'Numéro du modèle (1, 2…) pour une seule photo' } },
      required: ['article_id'],
    },
  },
  {
    name: 'commandes_speciales',
    description: "Liste les modèles proposés en commande spéciale (sur commande, non en stock) : nom, prix, tailles possibles, délai. Rappel : 50 % d'avance à la commande, validée sur WhatsApp.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'suivre_commande',
    description: "Donne l'état d'une commande passée sur le site Koloun Boutique, à partir de sa référence (KB-…).",
    input_schema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] },
  },
  {
    name: 'calculer_reduction',
    description: `Vérifie un prix négocié pour un article. La réduction maximale autorisée est de ${REMISE_MAX} %. Renvoie si le prix est accepté et le prix minimum possible.`,
    input_schema: {
      type: 'object',
      properties: { article_id: { type: 'integer' }, prix_propose: { type: 'number', description: 'Prix unitaire en GNF' } },
      required: ['article_id', 'prix_propose'],
    },
  },
  {
    name: 'transmettre_commande',
    description: "Transmet la commande au vendeur quand le client a TOUT confirmé (articles, tailles, quantités, prix, livraison ou retrait, nom, téléphone, adresse si livraison). Le vendeur le recontacte pour valider. Ne dis jamais que la commande est validée : dis qu'elle est transmise.",
    input_schema: {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: { article_id: { type: 'integer' }, taille: { type: 'string' }, quantite: { type: 'integer' }, prix_unitaire: { type: 'number', description: 'Prix accordé en GNF (prix normal ou réduit)' } },
            required: ['article_id', 'taille', 'quantite', 'prix_unitaire'],
          },
        },
        nom: { type: 'string' },
        telephone: { type: 'string' },
        mode: { type: 'string', enum: ['livraison', 'retrait'] },
        adresse: { type: 'string', description: 'Quartier et repère, obligatoire en livraison' },
        note: { type: 'string' },
      },
      required: ['articles', 'nom', 'telephone', 'mode'],
    },
  },
  {
    name: 'passer_a_un_humain',
    description: "Passe la conversation au vendeur : le client le demande, il est mécontent, il veut plus de " + REMISE_MAX + " % de réduction, ou tu ne sais pas répondre. Tu ne réponds plus ensuite dans cette conversation.",
    input_schema: { type: 'object', properties: { raison: { type: 'string' } }, required: ['raison'] },
  },
];

function consignes(conv) {
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Conakry' });
  return `Tu es le vendeur virtuel de Koloun Luxure, boutique de vêtements, chaussures et accessoires à Conakry (Guinée). Devise : « Qualité & Élégance ». Nous sommes le ${jour}.
Canal : ${conv.canal === 'whatsapp' ? 'WhatsApp' : conv.canal === 'messenger' ? 'Messenger' : 'test interne'}.${conv.nom ? ` Client : ${conv.nom}.` : ''}${conv.telephone ? ` Téléphone : ${conv.telephone}.` : ''}

LA BOUTIQUE
- Adresse : Lambanyi, Forage Dadis, Conakry. WhatsApp : +224 627 25 84 97. Site : ${SITE()}
- Livraison à Conakry (frais selon le quartier, confirmés par le vendeur) ou retrait gratuit en boutique.
- Paiement à la réception : espèces, Orange Money ou paiement marchand.
- Commandes spéciales (modèles sur commande) : 50 % d'avance à la commande, le reste à la livraison.

TES RÈGLES
- Réponds en français simple et chaleureux, vouvoiement. Messages courts (3 à 6 lignes), adaptés au téléphone. Pas de titres ni de tableaux ; tu peux mettre un mot en *gras*.
- Ne parle QUE de Koloun Luxure, de ses articles et des commandes. Pour tout autre sujet, ramène poliment la conversation à la boutique.
- N'invente JAMAIS un article, un prix, une taille ou un stock : vérifie toujours avec l'outil chercher_articles. Si rien ne correspond, propose une alternative ou une commande spéciale.
- Donne le lien de l'article pour que le client voie toutes les photos ; utilise envoyer_photos pour 1 à 4 photos quand c'est utile.
- Réduction : tu peux accorder jusqu'à ${REMISE_MAX} % maximum, et seulement si le client la demande. Vérifie toujours avec calculer_reduction. Commence par une petite réduction, pas directement le maximum. Au-delà, propose de passer la demande au vendeur (passer_a_un_humain).
- Commande : récapitule (articles, tailles, quantités, prix, total, livraison ou retrait, nom, téléphone, adresse) et demande confirmation. Quand le client confirme, utilise transmettre_commande, puis dis-lui que le vendeur va le recontacter pour valider. Ne dis jamais que la commande est « validée » ou « confirmée ».
- Ne donne jamais d'informations internes : prix d'achat, chiffre d'affaires, autres clients, fonctionnement technique. Ne dis pas que tu es une IA sauf si on te le demande ; si on te le demande, réponds honnêtement que tu es l'assistant virtuel de la boutique.
- Si le client est mécontent, demande un humain, ou pose une question à laquelle tu ne peux pas répondre avec certitude : utilise passer_a_un_humain.`;
}

// ---------------------------------------------------------------- Exécution des outils
async function executer(nom, e, ctx) {
  if (nom === 'chercher_articles') {
    const liste = await articles(e);
    if (!liste.length) return { resultat: 'Aucun article en stock ne correspond.' };
    return { nombre: liste.length, articles: liste.slice(0, 6).map(resumeArticle), remarque: liste.length > 6 ? `${liste.length - 6} autres articles, affiner la recherche ou envoyer le lien ${SITE()}/catalogue` : undefined };
  }
  if (nom === 'envoyer_photos') {
    const [a] = await articles({ ids: [e.article_id] });
    if (!a) return { erreur: 'Article introuvable ou épuisé.' };
    const modeles = e.modele ? [a.modeles[e.modele - 1]].filter(Boolean) : a.modeles.slice(0, 4);
    const photos = modeles.map((m) => m.photo).filter(Boolean);
    photos.forEach((p) => ctx.images.push({ url: p, legende: `${a.nom} — ${gnf(a.prix)}` }));
    return { envoye: photos.length, lien: `${SITE()}/article/${a.id}` };
  }
  if (nom === 'commandes_speciales') {
    const liste = await sql('SELECT id, nom, prix, tailles, delai FROM catalogue_special WHERE boutique_id = ? AND actif = 1 ORDER BY created_at DESC LIMIT 12', [BOUTIQUE_ID]);
    return liste.length
      ? { modeles: liste.map((s) => ({ nom: s.nom, prix: gnf(s.prix), avance_50_pourcent: gnf(nombre(s.prix) / 2), tailles: s.tailles, delai: s.delai, lien: `${SITE()}/commande-speciale/${s.id}` })) }
      : { resultat: 'Aucun modèle en commande spéciale pour le moment.' };
  }
  if (nom === 'suivre_commande') {
    const ref = String(e.reference || '').trim().toUpperCase();
    const [c] = await sql(`SELECT c.reference, ${STATUT_SQL} AS statut, c.mode_livraison, c.total_final, c.client_telephone, c.created_at FROM boutique_commandes c ${JOINTURE_LIVRAISON}
      WHERE c.boutique_id = ? AND (c.reference = ? OR c.code = ?) LIMIT 1`, [BOUTIQUE_ID, ref, String(e.reference || '').trim()]);
    if (!c) return { erreur: 'Aucune commande avec cette référence.' };
    // Sur WhatsApp/Messenger, on ne donne le détail qu'au client lui-même
    if (ctx.conv.telephone && c.client_telephone && c.client_telephone.replace(/\D/g, '').slice(-8) !== ctx.conv.telephone.replace(/\D/g, '').slice(-8)) {
      return { erreur: 'Cette commande appartient à un autre numéro : demande au client de vérifier sa référence.' };
    }
    const LIB = { nouvelle: 'en attente de confirmation', en_discussion: 'en attente de confirmation', validee: c.mode_livraison === 'retrait' ? 'prête à retirer en boutique' : 'expédiée (en cours de livraison)', livree: c.mode_livraison === 'retrait' ? 'retirée' : 'livrée', annulee: 'annulée' };
    return { reference: c.reference, etat: LIB[c.statut] || c.statut, total: gnf(c.total_final), date: new Date(c.created_at).toLocaleDateString('fr-FR') };
  }
  if (nom === 'calculer_reduction') {
    const [a] = await articles({ ids: [e.article_id] });
    if (!a) return { erreur: 'Article introuvable ou épuisé.' };
    const min = prixPlancher(a.prix); const propose = nombre(e.prix_propose);
    return propose >= min
      ? { accepte: true, prix_normal: gnf(a.prix), prix_accorde: gnf(propose), reduction: `${Math.round((1 - propose / a.prix) * 100)} %` }
      : { accepte: false, prix_normal: gnf(a.prix), prix_minimum: gnf(min), message: `En dessous de ${gnf(min)}, il faut l'accord du vendeur.` };
  }
  if (nom === 'transmettre_commande') {
    if (ctx.demande) return { erreur: 'Une commande a déjà été transmise dans ce message.' };
    const lignes = []; const ids = [...new Set((e.articles || []).map((x) => Number(x.article_id)))];
    const stock = await articles({ ids });
    for (const x of e.articles || []) {
      const a = stock.find((s) => s.id === Number(x.article_id));
      if (!a) return { erreur: `Article ${x.article_id} introuvable ou épuisé.` };
      const dispo = a.modeles.flatMap((m) => m.tailles).filter((t) => String(t.taille).toLowerCase() === String(x.taille).toLowerCase()).reduce((s, t) => s + t.stock, 0);
      const qte = Math.max(1, Math.floor(Number(x.quantite) || 1));
      if (dispo < qte) return { erreur: `« ${a.nom} » en taille ${x.taille} : seulement ${dispo} en stock.` };
      const prix = Math.max(nombre(x.prix_unitaire), 0);
      if (prix < prixPlancher(a.prix)) return { erreur: `Prix trop bas pour « ${a.nom} » (minimum ${gnf(prixPlancher(a.prix))}). Il faut l'accord du vendeur.` };
      lignes.push({ article_id: a.id, nom: a.nom, taille: x.taille, quantite: qte, prix_normal: a.prix, prix: Math.min(prix, a.prix), lien: `${SITE()}/article/${a.id}` });
    }
    if (!lignes.length) return { erreur: 'Aucun article dans la commande.' };
    if (e.mode === 'livraison' && !String(e.adresse || '').trim()) return { erreur: "Il manque l'adresse de livraison (quartier et repère)." };
    const total = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
    const d = new Date(); const ref = `AG-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    await exec(`INSERT INTO agent_demandes (boutique_id, conversation_id, reference, canal, client_nom, client_telephone, mode_livraison, adresse, lignes, total, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [BOUTIQUE_ID, ctx.conv.id, ref, ctx.conv.canal, String(e.nom).slice(0, 150), String(e.telephone).slice(0, 40), e.mode === 'livraison' ? 'livraison' : 'retrait', (e.adresse || '').slice(0, 255) || null, JSON.stringify(lignes), total, (e.note || '').slice(0, 500) || null]);
    await Notification.create({ boutique_id: BOUTIQUE_ID, type: 'commande_agent', message: `Commande ${ref} transmise par l'agent : ${String(e.nom).slice(0, 40)}, ${gnf(total)} (${e.mode === 'livraison' ? 'livraison' : 'retrait'}).`.slice(0, 255) }).catch(() => {});
    ctx.demande = ref;
    return { transmise: true, reference: ref, total: gnf(total), suite: 'Le vendeur recontacte le client pour valider (et confirmer les frais de livraison).' };
  }
  if (nom === 'passer_a_un_humain') {
    await exec("UPDATE agent_conversations SET mode = 'humain' WHERE id = ?", [ctx.conv.id]);
    await Notification.create({ boutique_id: BOUTIQUE_ID, type: 'agent_humain', message: `Un client attend un vendeur (${ctx.conv.nom || ctx.conv.telephone || ctx.conv.canal}) : ${String(e.raison || '').slice(0, 120)}`.slice(0, 255) }).catch(() => {});
    ctx.humain = true;
    return { fait: true, consigne: 'Dis au client, en une phrase, qu\'un vendeur lui répond très vite.' };
  }
  return { erreur: 'Outil inconnu.' };
}

// ---------------------------------------------------------------- Appel du modèle
async function appelerModele(corps) {
  const r = await fetch(`${API_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(45000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || `Service IA indisponible (${r.status})`), { code: r.status });
  return d;
}

async function depenseDuMois() {
  const [r] = await sql("SELECT COALESCE(SUM(cout_usd),0) AS total, COUNT(*) AS n FROM agent_echanges WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
  return { dollars: Number(r.total), reponses: Number(r.n) };
}

// Historique pour le modèle : les derniers échanges complets (texte + outils), dans l'ordre
async function historique(convId) {
  const lignes = await sql('SELECT api FROM agent_echanges WHERE conversation_id = ? ORDER BY id DESC LIMIT 10', [convId]);
  return lignes.reverse().flatMap((l) => { try { return JSON.parse(l.api); } catch { return []; } });
}

async function conversation(canal, identifiant, infos = {}) {
  await exec(`INSERT INTO agent_conversations (boutique_id, canal, identifiant, nom, telephone, derniere_activite) VALUES (?,?,?,?,?, NOW())
    ON DUPLICATE KEY UPDATE derniere_activite = NOW(), nom = COALESCE(VALUES(nom), nom), telephone = COALESCE(VALUES(telephone), telephone)`,
  [BOUTIQUE_ID, canal, String(identifiant).slice(0, 150), infos.nom || null, infos.telephone || null]);
  const [c] = await sql('SELECT * FROM agent_conversations WHERE boutique_id = ? AND canal = ? AND identifiant = ?', [BOUTIQUE_ID, canal, String(identifiant).slice(0, 150)]);
  return c;
}

const MESSAGE_ATTENTE = 'Merci pour votre message ! Un conseiller Koloun Luxure vous répond très vite.';

// Répond à un message client. Renvoie { textes: [..], images: [{url, legende}], mode, demande? }
async function repondre({ canal, identifiant, texte, nom, telephone }) {
  const conv = await conversation(canal, identifiant, { nom, telephone });
  await exec("INSERT INTO agent_messages (conversation_id, auteur, texte) VALUES (?, 'client', ?)", [conv.id, String(texte).slice(0, 4000)]);
  if (conv.mode === 'humain') return { textes: [], images: [], mode: 'humain' }; // le vendeur a la main : l'agent se tait

  const sortie = async (textes, images = [], extra = {}) => {
    for (const t of textes) await exec("INSERT INTO agent_messages (conversation_id, auteur, texte, images) VALUES (?, 'agent', ?, ?)", [conv.id, t, null]);
    if (images.length) await exec("INSERT INTO agent_messages (conversation_id, auteur, texte, images) VALUES (?, 'agent', NULL, ?)", [conv.id, JSON.stringify(images)]);
    return { textes, images, mode: extra.humain ? 'humain' : 'ia', demande: extra.demande };
  };

  if (!actif()) return sortie([MESSAGE_ATTENTE]);
  const depense = await depenseDuMois();
  if (depense.dollars >= BUDGET_MOIS) { // plafond atteint : on passe la main
    await exec("UPDATE agent_conversations SET mode = 'humain' WHERE id = ?", [conv.id]);
    return sortie([MESSAGE_ATTENTE], [], { humain: true });
  }

  const nouveaux = [{ role: 'user', content: String(texte).slice(0, 4000) }];
  const messages = [...await historique(conv.id), ...nouveaux];
  const ctx = { conv, images: [] };
  let entree = 0; let sortieJetons = 0; let textes = [];
  for (let tour = 0; tour < 6; tour += 1) {
    const d = await appelerModele({ model: MODELE, max_tokens: 700, system: consignes(conv), tools: OUTILS, messages });
    entree += d.usage?.input_tokens || 0; sortieJetons += d.usage?.output_tokens || 0;
    const contenu = d.content || [];
    messages.push({ role: 'assistant', content: contenu }); nouveaux.push({ role: 'assistant', content: contenu });
    const appels = contenu.filter((b) => b.type === 'tool_use');
    if (d.stop_reason !== 'tool_use' || !appels.length) {
      textes = contenu.filter((b) => b.type === 'text').map((b) => b.text.trim()).filter(Boolean);
      break;
    }
    const resultats = [];
    for (const a of appels) {
      let r;
      try { r = await executer(a.name, a.input || {}, ctx); } catch (e) { r = { erreur: e.message }; }
      resultats.push({ type: 'tool_result', tool_use_id: a.id, content: JSON.stringify(r).slice(0, 6000) });
    }
    messages.push({ role: 'user', content: resultats }); nouveaux.push({ role: 'user', content: resultats });
  }
  // L'échange doit se terminer par une réponse texte de l'agent (pour un historique valide)
  if (!textes.length) {
    textes = [ctx.humain ? MESSAGE_ATTENTE : 'Je vérifie et je reviens vers vous très vite.'];
    nouveaux.push({ role: 'assistant', content: [{ type: 'text', text: textes[0] }] });
  }
  const cout = (entree * PRIX_ENTREE + sortieJetons * PRIX_SORTIE) / 1e6;
  await exec('INSERT INTO agent_echanges (conversation_id, api, jetons_entree, jetons_sortie, cout_usd) VALUES (?,?,?,?,?)',
    [conv.id, JSON.stringify(nouveaux), entree, sortieJetons, cout]);
  return sortie(textes, ctx.images, { humain: ctx.humain, demande: ctx.demande });
}

module.exports = { repondre, conversation, depenseDuMois, actif, REMISE_MAX, BUDGET_MOIS, MODELE, OUTILS, executer, consignes, BOUTIQUE_ID };
