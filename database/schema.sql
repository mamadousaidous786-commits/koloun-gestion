-- ============================================================
-- KOLOUN LUXURE - GESTION COMMERCIALE (v2)
-- Schéma de base de données MySQL (WampServer)
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestionboutique CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestionboutique;

-- ---------------------------------------------------------
-- BOUTIQUES
-- ---------------------------------------------------------
CREATE TABLE boutiques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    adresse VARCHAR(255),
    telephone VARCHAR(50),
    logo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- ---------------------------------------------------------
-- UTILISATEURS
-- ---------------------------------------------------------
CREATE TABLE utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    role_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    email VARCHAR(150) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    mot_de_passe VARCHAR(255) NOT NULL,
    actif BOOLEAN DEFAULT TRUE,
    derniere_connexion DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------------------------------------------------------
-- SESSIONS
-- ---------------------------------------------------------
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    ip_address VARCHAR(50),
    date_connexion DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_deconnexion DATETIME,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- FOURNISSEURS
-- ---------------------------------------------------------
CREATE TABLE fournisseurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    telephone VARCHAR(50),
    adresse VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- PRODUITS (simplifié : nom, prix, description)
-- ---------------------------------------------------------
CREATE TABLE produits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    prix_normal DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- VARIANTES DU PRODUIT (une photo = une variante, avec ses propres tailles)
-- ---------------------------------------------------------
CREATE TABLE produit_variantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produit_id INT NOT NULL,
    image VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- TAILLES / QUANTITES (rattachées à une variante précise)
-- ---------------------------------------------------------
CREATE TABLE produit_tailles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produit_variante_id INT NOT NULL,
    taille VARCHAR(50) NOT NULL,
    quantite INT NOT NULL DEFAULT 0,
    seuil_alerte INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (produit_variante_id) REFERENCES produit_variantes(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- MOUVEMENTS DE STOCK (par taille)
-- ---------------------------------------------------------
CREATE TABLE mouvements_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produit_taille_id INT NOT NULL,
    type ENUM('entree','sortie') NOT NULL,
    quantite INT NOT NULL,
    motif VARCHAR(255),
    utilisateur_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produit_taille_id) REFERENCES produit_tailles(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- ---------------------------------------------------------
-- MOYENS DE PAIEMENT
-- ---------------------------------------------------------
CREATE TABLE moyens_paiement (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------
-- COMMANDES (commandes passées auprès des fournisseurs)
-- ---------------------------------------------------------
CREATE TABLE commandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    fournisseur_id INT NOT NULL,
    nom_commande VARCHAR(150),
    montant_total DECIMAL(12,2) NOT NULL,
    quantite_totale INT NOT NULL,
    transport DECIMAL(12,2) DEFAULT 0,
    prix_unitaire DECIMAL(12,2) GENERATED ALWAYS AS (montant_total / NULLIF(quantite_totale,0)) STORED,
    transport_unitaire DECIMAL(12,2) GENERATED ALWAYS AS (transport / NULLIF(quantite_totale,0)) STORED,
    cout_reel DECIMAL(12,2) GENERATED ALWAYS AS ((montant_total / NULLIF(quantite_totale,0)) + (transport / NULLIF(quantite_totale,0))) STORED,
    objectif DECIMAL(12,2) GENERATED ALWAYS AS (((montant_total / NULLIF(quantite_totale,0)) + (transport / NULLIF(quantite_totale,0))) * quantite_totale) STORED,
    montant_realise DECIMAL(12,2) DEFAULT 0,
    statut ENUM('en_cours','amortie','annulee') DEFAULT 'en_cours',
    date_commande DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
);

-- ---------------------------------------------------------
-- VENTES
-- ---------------------------------------------------------
CREATE TABLE ventes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    utilisateur_id INT NOT NULL,
    moyen_paiement_id INT NOT NULL,
    numero_recu VARCHAR(50) UNIQUE,
    montant_total DECIMAL(12,2) NOT NULL,
    observation VARCHAR(255),
    date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (moyen_paiement_id) REFERENCES moyens_paiement(id)
);

-- ---------------------------------------------------------
-- DETAILS DES VENTES (référence la taille précise vendue)
-- ---------------------------------------------------------
CREATE TABLE details_ventes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vente_id INT NOT NULL,
    produit_taille_id INT NOT NULL,
    quantite INT NOT NULL,
    prix_applique DECIMAL(12,2) NOT NULL,
    sous_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
    FOREIGN KEY (produit_taille_id) REFERENCES produit_tailles(id)
);

-- ---------------------------------------------------------
-- RECUS
-- ---------------------------------------------------------
CREATE TABLE recus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vente_id INT NOT NULL UNIQUE,
    chemin_pdf VARCHAR(255),
    qr_code VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    utilisateur_id INT,
    type VARCHAR(50) NOT NULL,
    message VARCHAR(255) NOT NULL,
    lue BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- ---------------------------------------------------------
-- HISTORIQUES
-- ---------------------------------------------------------
CREATE TABLE historiques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT,
    boutique_id INT,
    action VARCHAR(150) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id)
);

-- ---------------------------------------------------------
-- DONNEES INITIALES
-- ---------------------------------------------------------
INSERT INTO roles (nom, description) VALUES
('admin', 'Administrateur - tous les droits'),
('utilisateur', 'Vendeur / utilisateur standard');

INSERT INTO moyens_paiement (nom) VALUES
('Orange Money'), ('Paiement Marchand'), ('Cash');

INSERT INTO boutiques (nom, adresse, telephone) VALUES
('Koloun Luxure', 'Conakry, Guinée', '+224 000 00 00 00');

-- Compte administrateur par défaut
-- Email: admin@koloungestion.com | Mot de passe: Admin123
INSERT INTO utilisateurs (boutique_id, role_id, nom, prenom, email, mot_de_passe, actif) VALUES
(1, 1, 'Sow', 'Admin', 'admin@koloungestion.com', '$2b$10$lyuyKspnFw7EOOK0aXffU.SmMUaEQTPBT7BH9chpzFDVFvXhzCfqa', 1);
