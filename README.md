# Koloun Luxure — Gestion commerciale (v7)

Application web : React (client/) + Node/Express (server/) + MySQL (database/).

## Modules
- Ventes (client facultatif, reçu PDF, envoi du reçu par WhatsApp), Produits (variantes photo + tailles), Stock
- **Commandes spéciales** (avance facultative, statuts, encaissements, alerte à l'arrivée)
- **Clients** (fiche avec achats, commandes spéciales, dettes)
- **Dettes clients** (versements partiels, retards, rappel WhatsApp) — administrateur
- **Dépenses**, **Clôture de caisse**, **Rapport mensuel imprimable**, **Sauvegarde** — administrateur
- Comptabilité, Commandes fournisseurs, Statistiques, Utilisateurs, Notifications

## Nouvelle installation
1. `database/schema.sql` dans MySQL (crée aussi le compte admin : admin@koloungestion.com / Admin123 — à changer).
2. `server/` : `npm install`, copier `.env.example` en `.env`, `npm run dev`.
3. `client/` : `npm install`, `npm run dev`.

## Mise à jour d'une base existante (depuis la v6)
Exécuter UNE SEULE FOIS `database/migration_v7.sql` sur la base : elle ajoute les nouvelles tables sans toucher aux données.
