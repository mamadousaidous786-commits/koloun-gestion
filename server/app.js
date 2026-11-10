const express = require('express');
const cors = require('cors');
const compression = require('compression');
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
const groupeCommandeRoutes = require('./routes/groupeCommandeRoutes');
const statistiqueRoutes = require('./routes/statistiqueRoutes');
const utilisateurRoutes = require('./routes/utilisateurRoutes');
const fournisseurRoutes = require('./routes/fournisseurRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const clientRoutes = require('./routes/clientRoutes');
const commandeSpecialeRoutes = require('./routes/commandeSpecialeRoutes');
const detteRoutes = require('./routes/detteRoutes');
const depenseRoutes = require('./routes/depenseRoutes');
const clotureRoutes = require('./routes/clotureRoutes');
const rapportRoutes = require('./routes/rapportRoutes');
const sauvegardeRoutes = require('./routes/sauvegardeRoutes');

const app = express();
app.set('trust proxy', 1); // derrière le proxy de Render : adresses https correctes

app.use(compression()); // réponses 5 à 10 fois plus légères
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '30d', immutable: true }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/ventes', venteRoutes);
app.use('/api/recus', recuRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/groupes-commande', groupeCommandeRoutes);
app.use('/api/statistiques', statistiqueRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/commandes-speciales', commandeSpecialeRoutes);
app.use('/api/dettes', detteRoutes);
app.use('/api/depenses', depenseRoutes);
app.use('/api/clotures', clotureRoutes);
app.use('/api/rapports', rapportRoutes);
app.use('/api/sauvegarde', sauvegardeRoutes);
app.use('/api', fournisseurRoutes); // /api/fournisseurs
app.use('/api/notifications', notificationRoutes);

app.get('/sante', (req, res) => res.send('ok')); // léger : pour UptimeRobot

app.get('/', (req, res) => {
  res.json({ message: 'API Koloun Luxure - Gestion Commerciale opérationnelle.' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur.', erreur: err.message });
});

const PORT = process.env.PORT || 5000;

// Met la base à niveau automatiquement (groupes de commande) : plus besoin d'exécuter le SQL à la main.
// Sans effet si tout existe déjà.
async function migrerBase() {
  try {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS groupes_commande (
      id INT AUTO_INCREMENT PRIMARY KEY,
      boutique_id INT NOT NULL,
      nom VARCHAR(150) NOT NULL,
      date_commande DATE NOT NULL,
      transport DECIMAL(12,2) DEFAULT 0,
      transport_valide TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
    )`);
    const [colonne] = await sequelize.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commandes' AND COLUMN_NAME = 'groupe_id'",
      { type: sequelize.QueryTypes.SELECT }
    );
    if (Number(colonne.n) === 0) {
      await sequelize.query('ALTER TABLE commandes ADD COLUMN groupe_id INT NULL');
      await sequelize.query('ALTER TABLE commandes ADD CONSTRAINT fk_commandes_groupe FOREIGN KEY (groupe_id) REFERENCES groupes_commande(id) ON DELETE SET NULL');
    }
  } catch (e) {
    console.error('⚠️ Mise à niveau de la base (groupes) :', e.message);
  }
}

async function demarrerServeur() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données MySQL réussie.');
    await migrerBase();

    // En développement : synchronise les modèles (ne remplace pas schema.sql en prod)
    // await sequelize.sync({ alter: true });

    // Garde la connexion à la base active (pas de 1ère requête lente)
    setInterval(() => sequelize.query('SELECT 1').catch(() => {}), 4 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 Serveur Koloun Luxure démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données :', error.message);
  }
}

demarrerServeur();

module.exports = app;