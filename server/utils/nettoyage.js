const sequelize = require('../config/database');

const MOIS_CONSERVATION = 2; // les livraisons plus anciennes que 2 mois sont supprimées automatiquement

// Identifiant Cloudinary d'une photo à partir de son URL (ex. .../upload/v123/koloun/abc.jpg -> koloun/abc)
const identifiantCloudinary = (url) => {
  const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url || '');
  return m ? m[1] : null;
};

async function supprimerPhotosCloudinary(urls) {
  if (!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) return;
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const ids = [...new Set(urls.map(identifiantCloudinary).filter(Boolean))];
  for (const id of ids) await cloudinary.uploader.destroy(id).catch(() => {});
}

// Produits en rupture dans TOUTES leurs tailles depuis plus de 24 h : supprimés automatiquement (avec leurs photos).
// Les produits déjà vendus sont conservés : leur historique de ventes (reçus, comptabilité) en dépend.
async function purgerProduitsEnRupture() {
  try {
    const [produits] = await sequelize.query(
      `SELECT p.id FROM produits p
         JOIN produit_variantes v ON v.produit_id = p.id
         JOIN produit_tailles t ON t.produit_variante_id = v.id
        WHERE NOT EXISTS (
                SELECT 1 FROM details_ventes d
                  JOIN produit_tailles t2 ON t2.id = d.produit_taille_id
                  JOIN produit_variantes v2 ON v2.id = t2.produit_variante_id
                 WHERE v2.produit_id = p.id)
        GROUP BY p.id
       HAVING SUM(t.quantite) = 0 AND COUNT(t.id) > 0 AND MAX(t.updated_at) < DATE_SUB(NOW(), INTERVAL 1 DAY)`
    );
    if (!produits.length) return 0;
    const ids = produits.map((p) => p.id);
    const [images] = await sequelize.query('SELECT image FROM produit_variantes WHERE produit_id IN (:ids)', { replacements: { ids } });
    await sequelize.query('DELETE FROM produits WHERE id IN (:ids)', { replacements: { ids } });
    await supprimerPhotosCloudinary(images.map((i) => i.image));
    console.log(`🧹 ${ids.length} produit(s) en rupture de stock depuis plus d'un jour supprimé(s).`);
    return ids.length;
  } catch (e) {
    console.error('⚠️ Nettoyage des produits en rupture :', e.message);
    return 0;
  }
}

async function purgerLivraisons() {
  try {
    const [anciennes] = await sequelize.query(
      `SELECT l.id, l.image AS image FROM livraisons l WHERE l.date_livraison < DATE_SUB(CURDATE(), INTERVAL ${MOIS_CONSERVATION} MONTH)
       UNION ALL
       SELECT a.livraison_id, a.image FROM livraison_articles a JOIN livraisons l ON l.id = a.livraison_id
        WHERE l.date_livraison < DATE_SUB(CURDATE(), INTERVAL ${MOIS_CONSERVATION} MONTH)`
    );
    const [comptage] = await sequelize.query(`SELECT COUNT(*) AS n FROM livraisons WHERE date_livraison < DATE_SUB(CURDATE(), INTERVAL ${MOIS_CONSERVATION} MONTH)`);
    const n = Number(comptage[0].n);
    if (!n) return 0;
    await sequelize.query(
      `DELETE FROM livraisons WHERE date_livraison < DATE_SUB(CURDATE(), INTERVAL ${MOIS_CONSERVATION} MONTH)`
    );

    await supprimerPhotosCloudinary(anciennes.map((x) => x.image));
    console.log(`🧹 ${n} livraison(s) de plus de ${MOIS_CONSERVATION} mois supprimée(s).`);
    return n;
  } catch (e) {
    console.error('⚠️ Nettoyage des livraisons :', e.message);
    return 0;
  }
}

// Au démarrage (après 1 minute) puis une fois par jour
function planifierNettoyage() {
  const tout = () => { purgerLivraisons(); purgerProduitsEnRupture(); };
  setTimeout(tout, 60 * 1000);
  setInterval(tout, 6 * 60 * 60 * 1000); // toutes les 6 heures
}

module.exports = { purgerLivraisons, purgerProduitsEnRupture, planifierNettoyage, identifiantCloudinary };
