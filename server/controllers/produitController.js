const { Produit, ProduitVariante, ProduitTaille, MouvementStock, Notification } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const INCLUS_COMPLET = [{ model: ProduitVariante, include: [ProduitTaille] }];

// GET /api/produits
exports.listerProduits = async (req, res) => {
  try {
    const { boutique_id } = req.utilisateur;
    const { recherche } = req.query;

    const filtre = { boutique_id };
    if (recherche) filtre.nom = { [Op.like]: `%${recherche}%` };

    const produits = await Produit.findAll({
      where: filtre,
      include: INCLUS_COMPLET,
      order: [['nom', 'ASC']],
    });

    res.json(produits);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// GET /api/produits/:id
exports.obtenirProduit = async (req, res) => {
  try {
    const produit = await Produit.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
      include: INCLUS_COMPLET,
    });
    if (!produit) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json(produit);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/produits
// multipart/form-data : plusieurs "images" (une par variante) + "variantes" = JSON stringifié
// variantes = [{ tailles: [{ taille, quantite, seuil_alerte }] }]  (même ordre que les fichiers "images")
exports.creerProduit = async (req, res) => {
  try {
    const { nom, prix_normal, description } = req.body;
    const variantes = req.body.variantes ? JSON.parse(req.body.variantes) : [];

    const produit = await Produit.create({
      nom,
      prix_normal,
      description,
      boutique_id: req.utilisateur.boutique_id,
    });

    const fichiers = req.files || [];
    for (let i = 0; i < fichiers.length; i++) {
      const infosVariante = variantes[i] || { tailles: [] };

      const variante = await ProduitVariante.create({
        produit_id: produit.id,
        image: fichiers[i].path,
        description: infosVariante.description || null,
      });

      for (const t of infosVariante.tailles || []) {
        const taille = await ProduitTaille.create({
          produit_variante_id: variante.id,
          taille: t.taille,
          quantite: t.quantite || 0,
          seuil_alerte: t.seuil_alerte || 3,
        });

        if (taille.quantite > 0) {
          await MouvementStock.create({
            produit_taille_id: taille.id,
            type: 'entree',
            quantite: taille.quantite,
            motif: 'Stock initial',
            utilisateur_id: req.utilisateur.id,
          });
        }
      }
    }

    const produitComplet = await Produit.findByPk(produit.id, { include: INCLUS_COMPLET });
    res.status(201).json(produitComplet);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/produits/:id
// - nouvelles_variantes (JSON, même ordre que les fichiers "images" envoyés) : nouvelles photos + leurs tailles
// - variantes_existantes (JSON [{ id, tailles: [{ id?, taille, quantite, seuil_alerte }] }]) : mise à jour des tailles
// - variantes_a_supprimer (JSON [id, id, ...]) : variantes à retirer entièrement
exports.modifierProduit = async (req, res) => {
  try {
    const produit = await Produit.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!produit) return res.status(404).json({ message: 'Produit introuvable.' });

    const donnees = {};
    if (req.body.nom !== undefined) donnees.nom = req.body.nom;
    if (req.body.prix_normal !== undefined) donnees.prix_normal = req.body.prix_normal;
    if (req.body.description !== undefined) donnees.description = req.body.description;
    await produit.update(donnees);

    // Supprime les variantes retirées (+ leur fichier image)
    if (req.body.variantes_a_supprimer) {
      const idsASupprimer = JSON.parse(req.body.variantes_a_supprimer);
      for (const id of idsASupprimer) {
        const variante = await ProduitVariante.findOne({ where: { id, produit_id: produit.id } });
        if (variante) {
          const cheminFichier = path.join(__dirname, '..', variante.image);
          fs.unlink(cheminFichier, () => {});
          await variante.destroy(); // cascade sur ses tailles
        }
      }
    }

    // Met à jour les tailles des variantes existantes conservées
    if (req.body.variantes_existantes) {
      const variantesExistantes = JSON.parse(req.body.variantes_existantes);
      for (const v of variantesExistantes) {
        const variante = await ProduitVariante.findOne({ where: { id: v.id, produit_id: produit.id } });
        if (!variante) continue;

        const taillesActuelles = await ProduitTaille.findAll({ where: { produit_variante_id: variante.id } });
        const idsEnvoyes = (v.tailles || []).filter((t) => t.id).map((t) => t.id);

        for (const existante of taillesActuelles) {
          if (!idsEnvoyes.includes(existante.id)) await existante.destroy();
        }

        for (const t of v.tailles || []) {
          if (t.id) {
            await ProduitTaille.update(
              { taille: t.taille, quantite: t.quantite, seuil_alerte: t.seuil_alerte || 3 },
              { where: { id: t.id, produit_variante_id: variante.id } }
            );
          } else {
            await ProduitTaille.create({
              produit_variante_id: variante.id,
              taille: t.taille,
              quantite: t.quantite || 0,
              seuil_alerte: t.seuil_alerte || 3,
            });
          }
        }
      }
    }

    // Ajoute les nouvelles variantes (nouvelles photos avec leurs tailles)
    if (req.files && req.files.length > 0) {
      const nouvellesVariantes = req.body.nouvelles_variantes ? JSON.parse(req.body.nouvelles_variantes) : [];
      for (let i = 0; i < req.files.length; i++) {
        const infos = nouvellesVariantes[i] || { tailles: [] };
        const variante = await ProduitVariante.create({
          produit_id: produit.id,
          image: fichiers[i].path,
          description: infos.description || null,
        });

        for (const t of infos.tailles || []) {
          const taille = await ProduitTaille.create({
            produit_variante_id: variante.id,
            taille: t.taille,
            quantite: t.quantite || 0,
            seuil_alerte: t.seuil_alerte || 3,
          });
          if (taille.quantite > 0) {
            await MouvementStock.create({
              produit_taille_id: taille.id,
              type: 'entree',
              quantite: taille.quantite,
              motif: 'Stock initial',
              utilisateur_id: req.utilisateur.id,
            });
          }
        }
      }
    }

    const produitComplet = await Produit.findByPk(produit.id, { include: INCLUS_COMPLET });
    res.json(produitComplet);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/produits/:id
exports.supprimerProduit = async (req, res) => {
  try {
    const produit = await Produit.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!produit) return res.status(404).json({ message: 'Produit introuvable.' });

    await produit.destroy();
    res.json({ message: 'Produit supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/produits/:id/dupliquer -- Duplique un produit avec toutes ses variantes et tailles
exports.dupliquerProduit = async (req, res) => {
  try {
    const original = await Produit.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
      include: INCLUS_COMPLET,
    });
    if (!original) return res.status(404).json({ message: 'Produit introuvable.' });

    const copie = await Produit.create({
      boutique_id: req.utilisateur.boutique_id,
      nom: `${original.nom} (copie)`,
      prix_normal: original.prix_normal,
      description: original.description,
    });

    for (const variante of original.ProduitVariantes) {
      const nouvelleVariante = await ProduitVariante.create({
        produit_id: copie.id,
        image: variante.image, // réutilise le même fichier physique
        description: variante.description,
      });

      for (const taille of variante.ProduitTailles) {
        const nouvelleTaille = await ProduitTaille.create({
          produit_variante_id: nouvelleVariante.id,
          taille: taille.taille,
          quantite: taille.quantite,
          seuil_alerte: taille.seuil_alerte,
        });

        if (nouvelleTaille.quantite > 0) {
          await MouvementStock.create({
            produit_taille_id: nouvelleTaille.id,
            type: 'entree',
            quantite: nouvelleTaille.quantite,
            motif: `Duplication du produit #${original.id}`,
            utilisateur_id: req.utilisateur.id,
          });
        }
      }
    }

    const copieComplete = await Produit.findByPk(copie.id, { include: INCLUS_COMPLET });
    res.status(201).json(copieComplete);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// POST /api/produits/tailles/:id/stock (entrée/sortie manuelle de stock pour une taille précise)
exports.mouvementStock = async (req, res) => {
  try {
    const { type, quantite, motif } = req.body;
    const taille = await ProduitTaille.findOne({
      where: { id: req.params.id },
      include: [{ model: ProduitVariante, include: [{ model: Produit, where: { boutique_id: req.utilisateur.boutique_id } }] }],
    });
    if (!taille) return res.status(404).json({ message: 'Taille de produit introuvable.' });

    if (type === 'entree') {
      taille.quantite += Number(quantite);
    } else if (type === 'sortie') {
      if (taille.quantite < quantite) {
        return res.status(400).json({ message: 'Stock insuffisant.' });
      }
      taille.quantite -= Number(quantite);
    }
    await taille.save();

    await MouvementStock.create({
      produit_taille_id: taille.id,
      type,
      quantite,
      motif,
      utilisateur_id: req.utilisateur.id,
    });

    const nomProduit = taille.ProduitVariante.Produit.nom;
    if (taille.quantite === 0) {
      await Notification.create({
        boutique_id: req.utilisateur.boutique_id,
        type: 'rupture_stock',
        message: `Le produit "${nomProduit}" (taille ${taille.taille}) est en rupture de stock.`,
      });
    } else if (taille.quantite <= taille.seuil_alerte) {
      await Notification.create({
        boutique_id: req.utilisateur.boutique_id,
        type: 'stock_faible',
        message: `Le stock du produit "${nomProduit}" (taille ${taille.taille}) est faible (${taille.quantite} restant(s)).`,
      });
    }

    res.json(taille);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
