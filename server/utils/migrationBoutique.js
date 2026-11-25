// ============================================================
// KOLOUN BOUTIQUE — mise à niveau automatique de la base (v9)
// Appelée au démarrage du serveur : crée les tables de la boutique en ligne
// si elles n'existent pas. Aucune donnée existante n'est modifiée ni supprimée.
// ============================================================
module.exports = async function migrerBoutique(sequelize) {
  const etape = async (nom, fn) => {
    try { await fn(); } catch (e) { console.error(`⚠️ Boutique en ligne (${nom}) :`, e.message); }
  };
  const q = (sql) => sequelize.query(sql);
  const colonneExiste = async (table, colonne) => {
    const [r] = await sequelize.query(
      'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      { replacements: [table, colonne], type: sequelize.QueryTypes.SELECT }
    );
    return Number(r.n) > 0;
  };

  // Catégorie + visibilité en ligne d'un produit (facultatives, valeurs par défaut sans risque)
  await etape('produits.categorie', async () => {
    if (!(await colonneExiste('produits', 'categorie'))) await q('ALTER TABLE produits ADD COLUMN categorie VARCHAR(80) NULL');
  });
  await etape('produits.visible_boutique', async () => {
    if (!(await colonneExiste('produits', 'visible_boutique'))) await q('ALTER TABLE produits ADD COLUMN visible_boutique TINYINT(1) NOT NULL DEFAULT 1');
  });

  // Chaussures proposées en commande spéciale (publiées par la boutique, livrées en 2 à 3 semaines)
  await etape('catalogue_special', () => q(`CREATE TABLE IF NOT EXISTS catalogue_special (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    description TEXT NULL,
    prix DECIMAL(12,2) NOT NULL,
    images TEXT NULL,
    tailles VARCHAR(255) NULL,
    delai VARCHAR(60) NOT NULL DEFAULT '2 à 3 semaines',
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cs_boutique (boutique_id, actif)
  )`));

  // Commandes passées depuis l'application client
  await etape('boutique_commandes', () => q(`CREATE TABLE IF NOT EXISTS boutique_commandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    reference VARCHAR(30) NOT NULL UNIQUE,
    code VARCHAR(24) NOT NULL UNIQUE,
    type ENUM('panier','speciale','mixte') NOT NULL DEFAULT 'panier',
    statut ENUM('nouvelle','en_discussion','validee','livree','annulee') NOT NULL DEFAULT 'nouvelle',
    client_nom VARCHAR(150) NOT NULL,
    client_telephone VARCHAR(50) NOT NULL,
    note_client VARCHAR(500) NULL,
    total_initial DECIMAL(12,2) NOT NULL DEFAULT 0,
    remise DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_final DECIMAL(12,2) NOT NULL DEFAULT 0,
    note_vendeur VARCHAR(500) NULL,
    modifie_par INT NULL,
    commande_speciale_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bc_boutique (boutique_id, statut)
  )`));

  await etape('boutique_commande_lignes', () => q(`CREATE TABLE IF NOT EXISTS boutique_commande_lignes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commande_id INT NOT NULL,
    source ENUM('stock','speciale') NOT NULL,
    produit_id INT NULL,
    produit_variante_id INT NULL,
    produit_taille_id INT NULL,
    special_id INT NULL,
    nom VARCHAR(200) NOT NULL,
    image VARCHAR(500) NULL,
    taille VARCHAR(50) NULL,
    quantite INT NOT NULL DEFAULT 1,
    prix_unitaire DECIMAL(12,2) NOT NULL,
    prix_negocie DECIMAL(12,2) NULL,
    FOREIGN KEY (commande_id) REFERENCES boutique_commandes(id) ON DELETE CASCADE
  )`));

  // Comptes des clients de l'application (inscription téléphone / email / Google)
  await etape('comptes_clients', () => q(`CREATE TABLE IF NOT EXISTS comptes_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    telephone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    mot_de_passe VARCHAR(255) NULL,
    google_id VARCHAR(64) NULL,
    photo VARCHAR(500) NULL,
    client_id INT NULL,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    derniere_connexion DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cc_tel (boutique_id, telephone),
    UNIQUE KEY uq_cc_email (boutique_id, email),
    UNIQUE KEY uq_cc_google (boutique_id, google_id)
  )`));
  await etape('boutique_commandes.compte_client_id', async () => {
    if (!(await colonneExiste('boutique_commandes', 'compte_client_id'))) {
      await q('ALTER TABLE boutique_commandes ADD COLUMN compte_client_id INT NULL, ADD INDEX idx_bc_compte (compte_client_id)');
    }
  });

  // Circuit commande → livraison : mode (livraison / retrait), adresse, frais, motif, livraison liée dans « Livraisons »
  for (const [col, def] of [
    ['mode_livraison', "ENUM('livraison','retrait') NOT NULL DEFAULT 'livraison'"],
    ['adresse', 'VARCHAR(255) NULL'],
    ['frais_livraison', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['motif', 'VARCHAR(255) NULL'],
    ['livraison_id', 'INT NULL'],
    ['vente_id', 'INT NULL'], // vente enregistrée automatiquement à la livraison
  ]) {
    await etape(`boutique_commandes.${col}`, async () => {
      if (!(await colonneExiste('boutique_commandes', col))) await q(`ALTER TABLE boutique_commandes ADD COLUMN ${col} ${def}`);
    });
  }

  // Commandes spéciales : plusieurs photos, chacune avec un nom et une taille facultatifs
  await etape('commandes_speciales.articles', async () => {
    if (!(await colonneExiste('commandes_speciales', 'articles'))) await q('ALTER TABLE commandes_speciales ADD COLUMN articles TEXT NULL');
  });

  // Réservations (Koloun Gestion) : articles mis de côté pour un client, payés et remis le jour du retrait
  await etape('reservations', () => q(`CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    numero VARCHAR(30) NOT NULL,
    client_id INT NULL,
    client_nom VARCHAR(150) NOT NULL,
    client_telephone VARCHAR(40) NULL,
    date_retrait_prevue DATE NULL,
    note VARCHAR(255) NULL,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    statut ENUM('en_attente','retiree','annulee') NOT NULL DEFAULT 'en_attente',
    motif VARCHAR(255) NULL,
    vente_id INT NULL,
    cree_par INT NULL,
    traite_par INT NULL,
    date_traitement DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_res_boutique (boutique_id, statut)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
  await etape('reservation_articles', () => q(`CREATE TABLE IF NOT EXISTS reservation_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    produit_taille_id INT NULL,
    produit_nom VARCHAR(150) NOT NULL,
    taille VARCHAR(50) NULL,
    image VARCHAR(500) NULL,
    prix_normal DECIMAL(12,2) NOT NULL DEFAULT 0,
    prix DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantite INT NOT NULL DEFAULT 1,
    INDEX idx_resa (reservation_id),
    CONSTRAINT fk_resa_article FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));

  // Agent IA (WhatsApp, Messenger, test dans Gestion)
  await etape('agent_conversations', () => q(`CREATE TABLE IF NOT EXISTS agent_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    canal VARCHAR(20) NOT NULL,
    identifiant VARCHAR(150) NOT NULL,
    nom VARCHAR(150) NULL,
    telephone VARCHAR(40) NULL,
    mode ENUM('ia','humain') NOT NULL DEFAULT 'ia',
    derniere_activite DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_conv (boutique_id, canal, identifiant)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
  await etape('agent_messages', () => q(`CREATE TABLE IF NOT EXISTS agent_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    auteur ENUM('client','agent','vendeur') NOT NULL,
    texte TEXT NULL,
    images TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_msg (conversation_id, id),
    CONSTRAINT fk_agent_msg FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
  await etape('agent_echanges', () => q(`CREATE TABLE IF NOT EXISTS agent_echanges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    api MEDIUMTEXT NOT NULL,
    jetons_entree INT NOT NULL DEFAULT 0,
    jetons_sortie INT NOT NULL DEFAULT 0,
    cout_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_ech (conversation_id, id),
    CONSTRAINT fk_agent_ech FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
  await etape('agent_demandes', () => q(`CREATE TABLE IF NOT EXISTS agent_demandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    conversation_id INT NULL,
    reference VARCHAR(30) NOT NULL,
    canal VARCHAR(20) NOT NULL,
    client_nom VARCHAR(150) NULL,
    client_telephone VARCHAR(40) NULL,
    mode_livraison ENUM('livraison','retrait') NOT NULL DEFAULT 'retrait',
    adresse VARCHAR(255) NULL,
    lignes TEXT NOT NULL,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    note VARCHAR(500) NULL,
    statut ENUM('nouvelle','traitee','annulee') NOT NULL DEFAULT 'nouvelle',
    traite_par INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_dem (boutique_id, statut)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));

  // Réservations faites par les clients dans Koloun Boutique (« À confirmer » puis confirmées par le vendeur)
  await etape('reservations.en_ligne', async () => {
    await q("ALTER TABLE reservations MODIFY statut ENUM('a_confirmer','en_attente','retiree','annulee') NOT NULL DEFAULT 'en_attente'");
    for (const [col, def] of [['source', "VARCHAR(20) NOT NULL DEFAULT 'gestion'"], ['compte_client_id', 'INT NULL'], ['stock_bloque', 'TINYINT(1) NOT NULL DEFAULT 1'], ['confirme_par', 'INT NULL'], ['date_confirmation', 'DATETIME NULL']]) {
      if (!(await colonneExiste('reservations', col))) await q(`ALTER TABLE reservations ADD COLUMN ${col} ${def}`);
    }
  });

  // Réservations : date limite de retrait (annulation automatique) et rappel la veille
  await etape('reservations.expiration', async () => {
    if (!(await colonneExiste('reservations', 'date_expiration'))) {
      await q('ALTER TABLE reservations ADD COLUMN date_expiration DATETIME NULL');
      // Réservations déjà mises de côté : le délai part d'aujourd'hui (aucune annulation surprise)
      await q("UPDATE reservations SET date_expiration = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE statut = 'en_attente'");
    }
    if (!(await colonneExiste('reservations', 'rappel_envoye'))) await q('ALTER TABLE reservations ADD COLUMN rappel_envoye TINYINT(1) NOT NULL DEFAULT 0');
  });

  // « Prévenez-moi quand ma taille revient »
  await etape('alertes_tailles', () => q(`CREATE TABLE IF NOT EXISTS alertes_tailles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    produit_taille_id INT NOT NULL,
    compte_client_id INT NOT NULL,
    statut ENUM('attente','prevenu') NOT NULL DEFAULT 'attente',
    date_prevenu DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_alerte (produit_taille_id, compte_client_id),
    KEY idx_attente (statut, produit_taille_id)
  )`));

  // Discussion client ↔ vendeur dans l'application (texte, photos, cartes produit / commande / réservation)
  await etape('chat_conversations', () => q(`CREATE TABLE IF NOT EXISTS chat_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    compte_client_id INT NOT NULL,
    apercu VARCHAR(200) NULL,
    dernier_message_at DATETIME NULL,
    dernier_auteur VARCHAR(10) NULL,
    non_lu_vendeur INT NOT NULL DEFAULT 0,
    non_lu_client INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_chat_compte (boutique_id, compte_client_id),
    KEY idx_chat_recent (boutique_id, dernier_message_at)
  )`));
  await etape('chat_messages', () => q(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    auteur ENUM('client','vendeur','agent','systeme') NOT NULL,
    utilisateur_id INT NULL,
    type ENUM('texte','image','produit','panier','commande','reservation','prix') NOT NULL DEFAULT 'texte',
    texte TEXT NULL,
    donnees TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chat_msg (conversation_id, id)
  )`));
};
