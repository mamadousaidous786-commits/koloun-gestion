-- ============================================================
-- MIGRATION v7 : ajoute les nouveaux modules SANS toucher à tes données
-- (clients, commandes spéciales, dettes, dépenses, clôtures de caisse, partage de reçu)
-- À exécuter UNE SEULE FOIS sur la base existante (HeidiSQL -> onglet Requête -> F9).
-- Avant d'exécuter : sélectionne bien ta base (gestionboutique) dans la liste de gauche.
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    telephone VARCHAR(50),
    adresse VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
);

-- Lier une vente à un client (facultatif) et permettre le lien de partage des reçus
ALTER TABLE ventes ADD COLUMN client_id INT NULL;
ALTER TABLE ventes ADD CONSTRAINT fk_ventes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE recus ADD COLUMN token VARCHAR(64) NULL;

CREATE TABLE IF NOT EXISTS commandes_speciales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    client_id INT NULL,
    client_nom VARCHAR(150) NOT NULL,
    client_telephone VARCHAR(50),
    article VARCHAR(200) NOT NULL,
    details TEXT,
    image VARCHAR(255),
    prix_total DECIMAL(12,2) NOT NULL,
    date_livraison_prevue DATE,
    statut ENUM('en_attente','commandee','arrivee','livree','annulee') DEFAULT 'en_attente',
    observation VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS paiements_commandes_speciales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commande_speciale_id INT NOT NULL,
    montant DECIMAL(12,2) NOT NULL,
    moyen_paiement_id INT NULL,
    note VARCHAR(255),
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (commande_speciale_id) REFERENCES commandes_speciales(id) ON DELETE CASCADE,
    FOREIGN KEY (moyen_paiement_id) REFERENCES moyens_paiement(id)
);

CREATE TABLE IF NOT EXISTS dettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    client_id INT NULL,
    personne_nom VARCHAR(150) NOT NULL,
    telephone VARCHAR(50),
    motif VARCHAR(255),
    montant_initial DECIMAL(12,2) NOT NULL,
    date_dette DATE NOT NULL,
    date_echeance DATE NULL,
    observation VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS paiements_dettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dette_id INT NOT NULL,
    montant DECIMAL(12,2) NOT NULL,
    note VARCHAR(255),
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dette_id) REFERENCES dettes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS depenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    utilisateur_id INT NULL,
    categorie VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    montant DECIMAL(12,2) NOT NULL,
    date_depense DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clotures_caisse (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    utilisateur_id INT NULL,
    date_cloture DATE NOT NULL,
    attendu_cash DECIMAL(12,2) DEFAULT 0,
    attendu_om DECIMAL(12,2) DEFAULT 0,
    attendu_pm DECIMAL(12,2) DEFAULT 0,
    compte_cash DECIMAL(12,2),
    compte_om DECIMAL(12,2),
    compte_pm DECIMAL(12,2),
    ecart_cash DECIMAL(12,2),
    ecart_om DECIMAL(12,2),
    ecart_pm DECIMAL(12,2),
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_cloture_jour (boutique_id, date_cloture),
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);
