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
const pushRoutes = require('./routes/pushRoutes');
const suiviRoutes = require('./routes/suiviRoutes');
const livraisonRoutes = require('./routes/livraisonRoutes');
const reservationRoutes = require('./routes/reservationRoutes'); // articles réservés, payés au retrait
const agentRoutes = require('./routes/agentRoutes'); // agent IA (test, commandes transmises)
const chatRoutes = require('./routes/chatRoutes'); // discussion avec les clients de Koloun Boutique
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
const boutiqueRoutes = require('./routes/boutiqueRoutes'); // Koloun Boutique (application client)
const migrerBoutique = require('./utils/migrationBoutique');

// Le serveur ne doit jamais s'arrêter à cause d'une erreur isolée
process.on('uncaughtException', (e) => console.error('Erreur non gérée :', e && e.message));
process.on('unhandledRejection', (e) => console.error('Promesse rejetée :', e && e.message));

const app = express();
app.set('trust proxy', 1); // derrière le proxy de Render : adresses https correctes

app.use(compression()); // réponses 5 à 10 fois plus légères
app.use(cors());
app.use(express.json());
app.use('/api', require('./utils/tachesBoutique').surveillerStock); // taille revenue en stock → clients prévenus
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
app.use('/api/push', pushRoutes);
app.use('/api/livraisons', livraisonRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/suivi', suiviRoutes); // public : le client suit sa commande sans compte
app.use('/api/boutique', boutiqueRoutes); // Koloun Boutique : public + espace vendeur (avant la route '/api' des fournisseurs)
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
  if (err && (err.name === 'MulterError' || /images sont autoris/.test(err.message || ''))) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Une photo est trop lourde (12 Mo maximum).'
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Trop de photos (30 maximum par enregistrement).' : err.message;
    return res.status(400).json({ message });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur.', erreur: err.message });
});

const PORT = process.env.PORT || 5000;

// Met la base à niveau automatiquement (groupes de commande) : plus besoin d'exécuter le SQL à la main.
// Sans effet si tout existe déjà.
async function migrerSuivi() {
  const etape = async (nom, fn) => {
    try { await fn(); } catch (e) { console.error(`⚠️ Suivi commandes (${nom}) :`, e.message); }
  };
  const q = (sql) => sequelize.query(sql);
  await etape('table historique', () => q(`CREATE TABLE IF NOT EXISTS suivi_commandes_speciales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commande_speciale_id INT NOT NULL,
    statut VARCHAR(30) NOT NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_suivi_commande (commande_speciale_id)
  )`));
  await etape('colonne code_suivi', async () => {
    const [col] = await sequelize.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commandes_speciales' AND COLUMN_NAME = 'code_suivi'",
      { type: sequelize.QueryTypes.SELECT }
    );
    if (Number(col.n) === 0) await q('ALTER TABLE commandes_speciales ADD COLUMN code_suivi VARCHAR(20) NULL');
  });
  await etape('statuts', () => q("ALTER TABLE commandes_speciales MODIFY COLUMN statut ENUM('en_attente','commandee','entrepot','en_transit','arrivee','livree','annulee') DEFAULT 'en_attente'"));
  await etape('codes', () => q("UPDATE commandes_speciales SET code_suivi = LOWER(SUBSTRING(MD5(CONCAT(id, RAND(), NOW())), 1, 10)) WHERE code_suivi IS NULL"));
  await etape('historique initial', () => q(`INSERT INTO suivi_commandes_speciales (commande_speciale_id, statut, created_at)
    SELECT c.id, c.statut, c.created_at FROM commandes_speciales c
    WHERE NOT EXISTS (SELECT 1 FROM suivi_commandes_speciales s WHERE s.commande_speciale_id = c.id)`));
}

async function migrerHistoriqueVentes() {
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { console.error(`⚠️ Historique des ventes (${nom}) :`, e.message); } };
  const q = (sql) => sequelize.query(sql);
  const colonne = async (nom) => {
    const [r] = await sequelize.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'details_ventes' AND COLUMN_NAME = :nom",
      { replacements: { nom }, type: sequelize.QueryTypes.SELECT }
    );
    return Number(r.n) > 0;
  };
  await etape('colonnes', async () => {
    if (!(await colonne('produit_nom'))) await q('ALTER TABLE details_ventes ADD COLUMN produit_nom VARCHAR(200) NULL');
    if (!(await colonne('taille_nom'))) await q('ALTER TABLE details_ventes ADD COLUMN taille_nom VARCHAR(50) NULL');
    if (!(await colonne('prix_normal'))) await q('ALTER TABLE details_ventes ADD COLUMN prix_normal DECIMAL(12,2) NULL');
  });
  await etape('copie des ventes existantes', () => q(`UPDATE details_ventes d
      JOIN produit_tailles pt ON pt.id = d.produit_taille_id
      JOIN produit_variantes pv ON pv.id = pt.produit_variante_id
      JOIN produits p ON p.id = pv.produit_id
      SET d.produit_nom = p.nom, d.taille_nom = pt.taille, d.prix_normal = p.prix_normal
      WHERE d.produit_nom IS NULL`));
  await etape('lien produit', async () => {
    const lignesFk = await sequelize.query(
      `SELECT k.CONSTRAINT_NAME AS nom, r.DELETE_RULE AS regle
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA
        WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'details_ventes' AND k.COLUMN_NAME = 'produit_taille_id' AND k.REFERENCED_TABLE_NAME = 'produit_tailles'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const fk = lignesFk[0];
    if (fk && fk.regle === 'SET NULL') return;
    if (fk) await q(`ALTER TABLE details_ventes DROP FOREIGN KEY \`${fk.nom}\``);
    await q('ALTER TABLE details_ventes MODIFY COLUMN produit_taille_id INT NULL');
    await q('ALTER TABLE details_ventes ADD CONSTRAINT fk_details_taille FOREIGN KEY (produit_taille_id) REFERENCES produit_tailles(id) ON DELETE SET NULL');
  });
}

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
    await sequelize.query(`CREATE TABLE IF NOT EXISTS push_abonnements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      boutique_id INT NOT NULL,
      utilisateur_id INT NULL,
      role VARCHAR(30) NULL,
      endpoint_hash VARCHAR(64) NOT NULL UNIQUE,
      endpoint TEXT NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
    )`);
    // Suivi des commandes spéciales : chaque étape est indépendante (un échec n'empêche pas les autres)
    await migrerSuivi();
    await migrerHistoriqueVentes();
    await migrerBoutique(sequelize); // tables de Koloun Boutique
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS livraisons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boutique_id INT NOT NULL,
        numero VARCHAR(30) NOT NULL,
        date_livraison DATE NOT NULL,
        client_nom VARCHAR(150) NOT NULL,
        client_telephone VARCHAR(50) NULL,
        adresse VARCHAR(255) NULL,
        article VARCHAR(200) NOT NULL,
        taille VARCHAR(30) NULL,
        image VARCHAR(500) NULL,
        montant_livraison DECIMAL(12,2) DEFAULT 0,
        montant_a_encaisser DECIMAL(12,2) DEFAULT 0,
        livreur VARCHAR(100) NULL,
        note VARCHAR(255) NULL,
        statut ENUM('en_cours','livree','annulee') DEFAULT 'en_cours',
        motif VARCHAR(255) NULL,
        cree_par INT NULL,
        valide_par INT NULL,
        date_validation DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_livraisons_jour (boutique_id, date_livraison)
      )`);
      await sequelize.query(`CREATE TABLE IF NOT EXISTS livraison_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        livraison_id INT NOT NULL,
        designation VARCHAR(200) NOT NULL,
        taille VARCHAR(30) NULL,
        image VARCHAR(500) NULL,
        INDEX idx_livraison_articles (livraison_id),
        FOREIGN KEY (livraison_id) REFERENCES livraisons(id) ON DELETE CASCADE
      )`);
    } catch (e) { console.error('⚠️ Table livraisons :', e.message); }
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
    require('./utils/nettoyage').planifierNettoyage(); // supprime les livraisons de plus de 2 mois
    require('./utils/tachesBoutique').planifierTaches(); // réservations : rappel J-1 et délai de 7 jours ; tailles revenues

    app.listen(PORT, () => {
      console.log(`🚀 Serveur Koloun Luxure démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données :', error.message);
  }
}

demarrerServeur();

module.exports = app;
