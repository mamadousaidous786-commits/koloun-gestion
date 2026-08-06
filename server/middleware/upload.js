const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const suffixeUnique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, suffixeUnique + path.extname(file.originalname));
  },
});

const filtreFichier = (req, file, cb) => {
  const typesAutorises = /jpeg|jpg|png|webp/;
  const extensionValide = typesAutorises.test(path.extname(file.originalname).toLowerCase());
  const mimeValide = typesAutorises.test(file.mimetype);
  if (extensionValide && mimeValide) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images (jpeg, jpg, png, webp) sont autorisées.'));
  }
};

const upload = multer({ storage, fileFilter: filtreFichier, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = upload;
