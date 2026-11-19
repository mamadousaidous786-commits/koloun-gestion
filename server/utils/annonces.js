// ============================================================
// KOLOUN BOUTIQUE : notifications « Nouvel arrivage » aux clients
// Les téléphones qui ont accepté les notifications dans Koloun Boutique sont enregistrés dans
// push_abonnements avec le rôle « client » : ils ne reçoivent JAMAIS les alertes internes de Gestion
// (stock, livraisons…), seulement les annonces de nouveaux produits.
// ============================================================
const webpush = require('web-push');
const PushAbonnement = require('../models/PushAbonnement');
const { actif } = require('./push');

const BOUTIQUE_ID = Number(process.env.BOUTIQUE_PUBLIQUE_ID || 1);
const ROLE_CLIENT = 'client';

const gnf = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} GNF`;

// Photo légère pour la notification (Cloudinary : 720 px, jpg). Les photos locales ne sont pas envoyées.
function imageNotification(url) {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  return url.includes('/res.cloudinary.com/') ? url.replace('/upload/', '/upload/w_720,c_limit,q_auto,f_jpg/') : url;
}

// Tailles disponibles, dans l'ordre (30, 31, 32… ou S, M, L…)
function resumeTailles(tailles) {
  const liste = [...new Set(tailles.filter((t) => t.quantite > 0).map((t) => String(t.taille).trim()))];
  if (!liste.length) return '';
  const nombres = liste.every((t) => /^\d+([.,]\d+)?$/.test(t));
  if (nombres) {
    const tri = liste.map((t) => Number(t.replace(',', '.'))).sort((a, b) => a - b);
    return tri.length > 3 ? `tailles ${tri[0]} à ${tri[tri.length - 1]}` : `taille${tri.length > 1 ? 's' : ''} ${tri.join(', ')}`;
  }
  return `taille${liste.length > 1 ? 's' : ''} ${liste.slice(0, 5).join(', ')}${liste.length > 5 ? '…' : ''}`;
}

// Nombre de téléphones clients prévenus (affiché dans Gestion)
const compterAbonnes = () => PushAbonnement.count({ where: { boutique_id: BOUTIQUE_ID, role: ROLE_CLIENT } });

// Envoie l'annonce à tous les clients abonnés, par paquets de 50 (ne bloque pas l'enregistrement du produit)
async function annoncerArrivage(produit) {
  if (!actif || !produit || Number(produit.boutique_id) !== BOUTIQUE_ID) return 0;
  if (produit.visible_boutique === false || produit.visible_boutique === 0) return 0;
  const variantes = produit.ProduitVariantes || [];
  const tailles = variantes.flatMap((v) => v.ProduitTailles || []);
  if (!tailles.some((t) => t.quantite > 0)) return 0; // rien à vendre : pas d'annonce

  const couleurs = variantes.length > 1 ? ` · ${variantes.length} modèles` : '';
  const charge = JSON.stringify({
    titre: `Nouvel arrivage : ${produit.nom}`,
    corps: [`${gnf(produit.prix_normal)}${couleurs}`, resumeTailles(tailles)].filter(Boolean).join(' · ') + '\nDisponible chez Koloun Luxure, Lambanyi.',
    image: imageNotification(variantes[0]?.image),
    url: `/article/${produit.id}`,
    tag: `arrivage-${produit.id}`,
  });

  const abonnes = await PushAbonnement.findAll({ where: { boutique_id: BOUTIQUE_ID, role: ROLE_CLIENT } });
  let recus = 0;
  for (let i = 0; i < abonnes.length; i += 50) {
    await Promise.all(abonnes.slice(i, i + 50).map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 3 * 24 * 3600, urgency: 'normal' });
        recus += 1;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await a.destroy().catch(() => {}); // application désinstallée ou notifications refusées
      }
    }));
  }
  return recus;
}

module.exports = { annoncerArrivage, compterAbonnes, BOUTIQUE_ID, ROLE_CLIENT };
