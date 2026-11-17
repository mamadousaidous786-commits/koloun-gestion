const sequelize = require('../config/database');

const MOIS_CONSERVATION = 2; // les livraisons plus anciennes que 2 mois sont supprimées automatiquement

// Identifiant Cloudinary d'une photo à partir de son URL (ex. .../upload/v123/koloun/abc.jpg -> koloun/abc)
const identifiantCloudinary = (url) => {
  const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url || '');
  return m ? m[1] : null;
};

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

    // On libère aussi les photos stockées sur Cloudinary (si configuré)
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const ids = [...new Set(anciennes.map((a) => identifiantCloudinary(a.image)).filter(Boolean))];
      for (const id of ids) await cloudinary.uploader.destroy(id).catch(() => {});
    }
    console.log(`🧹 ${n} livraison(s) de plus de ${MOIS_CONSERVATION} mois supprimée(s).`);
    return n;
  } catch (e) {
    console.error('⚠️ Nettoyage des livraisons :', e.message);
    return 0;
  }
}

// Au démarrage (après 1 minute) puis une fois par jour
function planifierNettoyage() {
  setTimeout(purgerLivraisons, 60 * 1000);
  setInterval(purgerLivraisons, 24 * 60 * 60 * 1000);
}

module.exports = { purgerLivraisons, planifierNettoyage, identifiantCloudinary };
