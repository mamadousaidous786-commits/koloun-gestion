const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Envoi de fichiers (photos) :
 *  - si les variables CLOUDINARY_* sont renseignées → la photo est envoyée sur Cloudinary (stockage permanent)
 *  - sinon → la photo est enregistrée sur le disque du serveur (dossier /uploads), pratique en local
 * Dans les deux cas, chaque fichier reçoit `file.path` : l'adresse à enregistrer en base de données.
 */
const cloudinaryActif = !!(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

const filtreFichier = (req, file, cb) => {
  const types = /jpeg|jpg|png|webp/;
  const extensionValide = types.test(path.extname(file.originalname).toLowerCase());
  const mimeValide = types.test(file.mimetype);
  if (extensionValide && mimeValide) cb(null, true);
  else cb(new Error('Seules les images (jpeg, jpg, png, webp) sont autorisées.'));
};

const memoire = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtreFichier,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo par image
});

let cloudinary = null;
function obtenirCloudinary() {
  if (!cloudinary) {
    cloudinary = require('cloudinary').v2; // chargé seulement si nécessaire
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  return cloudinary;
}

function enregistrerFichier(file) {
  if (cloudinaryActif) {
    return new Promise((resolve, reject) => {
      const flux = obtenirCloudinary().uploader.upload_stream({ folder: 'koloun' }, (erreur, resultat) => {
        if (erreur) return reject(erreur);
        file.path = resultat.secure_url;
        resolve();
      });
      flux.end(file.buffer);
    });
  }
  const dossier = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
  const nom = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`;
  return fs.promises.writeFile(path.join(dossier, nom), file.buffer).then(() => {
    file.path = `/uploads/${nom}`;
  });
}

function enchainer(middlewareMulter) {
  return (req, res, next) => {
    middlewareMulter(req, res, (erreur) => {
      if (erreur) return next(erreur);
      const fichiers = req.files || (req.file ? [req.file] : []);
      Promise.all(fichiers.map(enregistrerFichier)).then(() => next()).catch(next);
    });
  };
}

module.exports = {
  array: (champ, max) => enchainer(memoire.array(champ, max)),
  single: (champ) => enchainer(memoire.single(champ)),
};
