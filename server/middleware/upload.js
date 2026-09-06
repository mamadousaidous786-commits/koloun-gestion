const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Stockage direct sur Cloudinary : les photos restent disponibles en permanence,
// même après un redémarrage ou une mise en veille du serveur (contrairement au disque local).
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'koloun-produits',
    allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max par image
});

module.exports = upload;
