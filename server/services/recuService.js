const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Génère un reçu PDF pour une vente et l'enregistre dans /uploads/recus.
 * @param {object} vente - instance Vente avec DetailVentes, Produits, Utilisateur, MoyenPaiement
 * @param {object} boutique - instance Boutique (nom, adresse, telephone)
 * @returns {string} chemin relatif du fichier PDF généré
 */
function genererRecuPDF(vente, boutique) {
  const dossierRecus = path.join(__dirname, '..', 'uploads', 'recus');
  if (!fs.existsSync(dossierRecus)) fs.mkdirSync(dossierRecus, { recursive: true });

  const nomFichier = `recu-${vente.numero_recu}.pdf`;
  const cheminComplet = path.join(dossierRecus, nomFichier);

  const doc = new PDFDocument({ size: [227, 500], margin: 15 }); // format ticket ~80mm
  doc.pipe(fs.createWriteStream(cheminComplet));

  doc.fontSize(14).font('Helvetica-Bold').text(boutique.nom.toUpperCase(), { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(boutique.adresse || '', { align: 'center' });
  doc.text(boutique.telephone || '', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('--------------------------------', { align: 'center' });
  doc.text(`Reçu N°: ${vente.numero_recu}`);
  doc.text(`Date: ${new Date(vente.date_vente).toLocaleString('fr-FR')}`);
  doc.text(`Vendeur: ${vente.Utilisateur.prenom || ''} ${vente.Utilisateur.nom}`);
  doc.text('--------------------------------', { align: 'center' });

  doc.moveDown(0.3);
  vente.DetailVentes.forEach((detail) => {
    const nomProduit = detail.ProduitTaille.ProduitVariante.Produit.nom;
    const taille = detail.ProduitTaille.taille;
    doc.font('Helvetica-Bold').text(`${nomProduit} (Taille ${taille})`);
    doc.font('Helvetica').text(
      `${detail.quantite} x ${Number(detail.prix_applique).toLocaleString('fr-FR')} GNF = ${Number(detail.sous_total).toLocaleString('fr-FR')} GNF`
    );
  });

  doc.moveDown(0.3);
  doc.text('--------------------------------', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).text(`TOTAL: ${Number(vente.montant_total).toLocaleString('fr-FR')} GNF`, { align: 'right' });
  doc.fontSize(8).font('Helvetica').text(`Paiement: ${vente.MoyenPaiement.nom}`, { align: 'right' });
  doc.moveDown(0.5);
  doc.text('--------------------------------', { align: 'center' });
  doc.fontSize(9).text('Merci de votre confiance !', { align: 'center' });
  doc.text(boutique.nom, { align: 'center' });

  doc.end();

  return `/uploads/recus/${nomFichier}`;
}

module.exports = { genererRecuPDF };
