-- ============================================================
-- MIGRATION v8 : groupes de commande (transport partagé)
-- À exécuter UNE SEULE FOIS (HeidiSQL -> sélectionne ta base gestionboutique -> Requête -> F9)
-- Aucune donnée existante n'est modifiée.
-- ============================================================
USE gestionboutique;

CREATE TABLE IF NOT EXISTS groupes_commande (
    id INT AUTO_INCREMENT PRIMARY KEY,
    boutique_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    date_commande DATE NOT NULL,
    transport DECIMAL(12,2) DEFAULT 0,
    transport_valide TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE CASCADE
);

ALTER TABLE commandes ADD COLUMN groupe_id INT NULL;
ALTER TABLE commandes ADD CONSTRAINT fk_commandes_groupe FOREIGN KEY (groupe_id) REFERENCES groupes_commande(id) ON DELETE SET NULL;
