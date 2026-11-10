const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const formaterGNF = (n) => `${Number(n).toLocaleString('fr-FR')} GNF`;

// Dessine le contenu du reçu (format ticket ~80 mm) dans un document PDF
function dessinerRecu(doc, vente, boutique) {
  doc.fontSize(14).font('Helvetica-Bold').text(boutique.nom.toUpperCase(), { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(boutique.adresse || '', { align: 'center' });
  doc.text(boutique.telephone || '', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('--------------------------------', { align: 'center' });
  doc.text(`Reçu N°: ${vente.numero_recu}`);
  doc.text(`Date: ${new Date(vente.date_vente).toLocaleString('fr-FR')}`);
  doc.text(`Vendeur: ${vente.Utilisateur.prenom || ''} ${vente.Utilisateur.nom}`);
  if (vente.Client) doc.text(`Client: ${vente.Client.nom}`);
  doc.text('--------------------------------', { align: 'center' });

  doc.moveDown(0.3);
  vente.DetailVentes.forEach((detail) => {
    const nomProduit = detail.ProduitTaille.ProduitVariante.Produit.nom;
    const taille = detail.ProduitTaille.taille;
    doc.font('Helvetica-Bold').text(`${nomProduit} (Taille ${taille})`);
    doc.font('Helvetica').text(`${detail.quantite} x ${formaterGNF(detail.prix_applique)} = ${formaterGNF(detail.sous_total)}`);
  });

  doc.moveDown(0.3);
  doc.text('--------------------------------', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).text(`TOTAL: ${formaterGNF(vente.montant_total)}`, { align: 'right' });
  doc.fontSize(8).font('Helvetica').text(`Paiement: ${vente.MoyenPaiement.nom}`, { align: 'right' });
  doc.moveDown(0.5);
  doc.text('--------------------------------', { align: 'center' });
  doc.fontSize(9).text('Merci de votre confiance !', { align: 'center' });
  doc.text(boutique.nom, { align: 'center' });
}

/**
 * Génère un reçu PDF et l'enregistre dans /uploads/recus (téléchargement direct).
 * @returns {string} chemin relatif du fichier PDF généré
 */
function genererRecuPDF(vente, boutique) {
  const dossierRecus = path.join(__dirname, '..', 'uploads', 'recus');
  if (!fs.existsSync(dossierRecus)) fs.mkdirSync(dossierRecus, { recursive: true });

  const nomFichier = `recu-${vente.numero_recu}.pdf`;
  const doc = new PDFDocument({ size: [227, 500], margin: 15 });
  doc.pipe(fs.createWriteStream(path.join(dossierRecus, nomFichier)));
  dessinerRecu(doc, vente, boutique);
  doc.end();

  return `/uploads/recus/${nomFichier}`;
}

/** Génère le reçu à la volée et l'envoie directement dans la réponse HTTP (lien de partage permanent). */
function envoyerRecuPDF(vente, boutique, res) {
  const doc = new PDFDocument({ size: [227, 500], margin: 15 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recu-${vente.numero_recu}.pdf"`);
  doc.pipe(res);
  dessinerRecu(doc, vente, boutique);
  doc.end();
}

module.exports = { genererRecuPDF, envoyerRecuPDF };
