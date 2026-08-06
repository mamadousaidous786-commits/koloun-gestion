# Koloun Luxure — Application de Gestion Commerciale

Application web de gestion commerciale (ERP) pour la boutique **Koloun Luxure**, construite exactement selon l'architecture demandée : **React.js + Node.js/Express + MySQL (Sequelize)**.

## Structure du projet

```
gestion-boutique/
├── client/       → Frontend React (Vite + Tailwind CSS)
├── server/       → Backend API REST (Node.js + Express + Sequelize)
└── database/     → Schéma SQL (schema.sql)
```

## 1. Base de données (WampServer / MySQL)

1. Démarrez WampServer (ou MySQL).
2. Ouvrez phpMyAdmin ou la console MySQL.
3. Importez le fichier `database/schema.sql` :
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   Cela crée la base `koloun_gestion` avec toutes les tables, les rôles (admin/utilisateur), les moyens de paiement (Orange Money, Paiement Marchand, Cash) et une boutique par défaut "Koloun Luxure".

## 2. Backend (server/)

```bash
cd server
npm install
cp .env.example .env
```

Modifiez `.env` avec vos identifiants MySQL (DB_USER, DB_PASSWORD...) et changez `JWT_SECRET`.

```bash
npm run dev
```

L'API démarre sur `http://localhost:5000`.

### Créer le premier administrateur

Comme la table `utilisateurs` est vide au départ, créez le premier admin directement en base (le mot de passe doit être haché en bcrypt), ou temporairement ouvrez la route `/api/auth/register` sans protection le temps de créer ce premier compte, puis remettez la protection.

## 3. Frontend (client/)

```bash
cd client
npm install
npm run dev
```

L'application démarre sur `http://localhost:3000` et communique avec l'API via le proxy Vite (`/api`, `/uploads`).

## 4. Fonctionnalités livrées (conformes au cahier des charges)

- ✅ Authentification JWT + rôles (Administrateur / Utilisateur)
- ✅ Gestion des produits (catégories, marques, images, prix normal/réduit, stock)
- ✅ Gestion du stock (entrées/sorties, alertes de rupture et stock faible)
- ✅ Ventes multi-produits avec 3 moyens de paiement (Orange Money, Paiement Marchand, Cash)
- ✅ Génération de reçus PDF (format ticket, téléchargeables, imprimables)
- ✅ Commandes fournisseurs avec calcul automatique de rentabilité (coût réel, objectif, amortissement)
- ✅ Notifications automatiques (rupture de stock, stock faible, objectif atteint)
- ✅ Tableaux de bord Admin et Utilisateur avec graphiques (Chart.js)
- ✅ Recherche intelligente (par produit, marque, catégorie...)
- ✅ Historique des opérations et des connexions
- ✅ Architecture prête pour le multi-boutiques et une future application mobile (API REST découplée)

## 5. Prochaines étapes suggérées

1. Ajouter les exports Excel/PDF des rapports.
2. Ajouter le WhatsApp/e-mail pour l'envoi des reçus.
3. Ajouter la sauvegarde automatique de la base de données.
4. Connecter une imprimante thermique (58mm/80mm) via WebUSB ou un pont local.
5. Décliner une application mobile (React Native) branchée sur la même API REST.

---
*Développé pour Koloun Luxure — Qualité & Élégance.*
