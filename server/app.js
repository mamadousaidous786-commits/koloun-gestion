const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const sequelize = require('./config/database');
require('./models'); // charge les modèles + associations

const authRoutes = require('./routes/authRoutes');
const produitRoutes = require('./routes/produitRoutes');
const venteRoutes = require('./routes/venteRoutes');
const recuRoutes = require('./routes/recuRoutes');
const commandeRoutes = require('./routes/commandeRoutes');
const statistiqueRoutes = require('./routes/statistiqueRoutes');
const utilisateurRoutes = require('./routes/utilisateurRoutes');
const fournisseurRoutes = require('./routes/fournisseurRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/ventes', venteRoutes);
app.use('/api/recus', recuRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/statistiques', statistiqueRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api', fournisseurRoutes); // /api/fournisseurs
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Koloun Luxure - Gestion Commerciale opérationnelle.' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur.', erreur: err.message });
});

const PORT = process.env.PORT || 5000;

async function demarrerServeur() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données MySQL réussie.');

    // En développement : synchronise les modèles (ne remplace pas schema.sql en prod)
    // await sequelize.sync({ alter: true });

    app.listen(PORT, () => {
      console.log(`🚀 Serveur Koloun Luxure démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données :', error.message);
  }
}

demarrerServeur();

module.exports = app;
