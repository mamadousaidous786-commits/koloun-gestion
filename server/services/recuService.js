const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


// Helvetica ne sait pas écrire l'espace fine de toLocaleString : on met des espaces normaux
const nombre = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const gnf = (n) => `${nombre(n)} GNF`;
// Texte enregistré avec le mauvais encodage (ex. « GuinÃ©e ») : on le répare
const propre = (t) => (t && /[ÃÂ]/.test(t) ? Buffer.from(t, 'latin1').toString('utf8') : t);
const dateFR = (d) => {
  const x = new Date(d);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

// Palette du modèle validé : noir / or / crème
const NOIR = '#111111';
const OR = '#c9a24b';
const CREME = '#f7f3ea';
const TEXTE = '#111111';
const GRIS_T = '#6b6b6b';
const HAUT_PAGE = 842;

function pied(doc) {
  const W = doc.page.width;
  doc.rect(0, HAUT_PAGE - 54, W, 54).fill(NOIR);
  doc.rect(0, HAUT_PAGE - 54, W, 3).fill(OR);
  doc.fillColor(OR).font('Times-Bold').fontSize(9).text('KOLOUN LUXURE', 0, HAUT_PAGE - 40, { width: W, align: 'center' });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(7.5).text('Qualité & Élégance  |  Conakry, Guinée', 0, HAUT_PAGE - 26, { width: W, align: 'center' });
}

function entetePage(doc, d) {
  const W = doc.page.width;
  doc.rect(0, 0, W, 128).fill(NOIR);
  doc.rect(0, 128, W, 4).fill(OR);
  doc.fillColor(OR).font('Times-Bold').fontSize(27).text(d.boutique.nom.toUpperCase(), 45, 48, { lineBreak: false });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8.5).text('Qualité & Élégance', 45, 84, { lineBreak: false });
  doc.fillColor(OR).font('Times-Bold').fontSize(27).text(d.titre, 45, 48, { width: W - 90, align: 'right', lineBreak: false });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8.5)
    .text(`N° ${d.numero}`, 45, 84, { width: W - 90, align: 'right', lineBreak: false })
    .text(`Date : ${d.date}`, 45, 97, { width: W - 90, align: 'right', lineBreak: false });
}

function enteteTableau(doc, y, col) {
  const L = 45; const R = 550;
  doc.rect(L, y, R - L, 25).fill(NOIR);
  doc.fillColor(OR).font('Helvetica-Bold').fontSize(7.5);
  doc.text('DÉSIGNATION', L + 10, y + 9, { lineBreak: false });
  doc.text('QTÉ', col.qte - 20, y + 9, { width: 40, align: 'center', lineBreak: false });
  doc.text('PRIX UNIT.', col.pu - 70, y + 9, { width: 70, align: 'right', lineBreak: false });
  doc.text('PRIX RÉDUIT', col.red - 70, y + 9, { width: 70, align: 'right', lineBreak: false });
  doc.text('TOTAL', col.tot - 70, y + 9, { width: 70, align: 'right', lineBreak: false });
  return y + 25;
}

/**
 * Reçu A4 au design validé (bandeau noir, or, crème) :
 *  donnees = { boutique, titre, numero, date, client, soustitre, lignes:[{designation, qte, normal, reduit, total}],
 *              total, paiement:[[libellé, valeur]] }
 */
function dessinerRecu(doc, d) {
  const L = 45; const R = 550; const W = R - L;
  const col = { qte: 262, pu: 358, red: 453, tot: R - 10 };

  entetePage(doc, d);

  // ----- Client -----
  let y = 160;
  doc.roundedRect(L, y, W, 50, 4).fill(CREME);
  doc.rect(L, y, 3, 50).fill(OR);
  doc.fillColor(GRIS_T).font('Helvetica').fontSize(7.5).text('CLIENT', L + 19, y + 10, { lineBreak: false });
  doc.fillColor(TEXTE).font('Helvetica-Bold').fontSize(12).text(d.client, L + 19, y + 24, { width: 300, lineBreak: false });
  doc.fillColor(GRIS_T).font('Helvetica').fontSize(8).text(d.soustitre, L, y + 24, { width: W - 18, align: 'right', lineBreak: false });
  y += 78;

  // ----- Tableau -----
  y = enteteTableau(doc, y, col);
  d.lignes.forEach((l, i) => {
    if (y + 34 > HAUT_PAGE - 80) {
      pied(doc); doc.addPage(); entetePage(doc, d); y = enteteTableau(doc, 160, col);
    }
    if (i % 2 === 0) doc.rect(L, y, W, 34).fill(CREME);
    const reduit = Number(l.reduit) < Number(l.normal);
    doc.fillColor(TEXTE).font('Helvetica-Bold').fontSize(8.5).text(l.designation, L + 10, y + 13, { width: col.qte - L - 40, height: 12, ellipsis: true });
    doc.font('Helvetica').text(String(l.qte), col.qte - 20, y + 13, { width: 40, align: 'center', lineBreak: false });

    const normalTxt = gnf(l.normal);
    doc.fillColor(reduit ? '#8a8a8a' : TEXTE).font('Helvetica').fontSize(8.5).text(normalTxt, col.pu - 90, y + 13, { width: 90, align: 'right', lineBreak: false });
    if (reduit) {
      const largeur = doc.widthOfString(normalTxt);
      doc.moveTo(col.pu - largeur, y + 17).lineTo(col.pu, y + 17).lineWidth(0.7).strokeColor('#8a8a8a').stroke();
    }
    doc.fillColor(TEXTE).font('Helvetica').text(reduit ? gnf(l.reduit) : '—', col.red - 90, y + 13, { width: 90, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').text(gnf(l.total), col.tot - 90, y + 13, { width: 90, align: 'right', lineBreak: false });
    y += 34;
  });
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.6).strokeColor('#e3d9bf').stroke();
  y += 18;

  // Place pour les totaux : sinon nouvelle page
  const nbLignesTotaux = 2 + d.paiement.length;
  if (y + 40 + nbLignesTotaux * 18 + 90 > HAUT_PAGE - 70) { pied(doc); doc.addPage(); entetePage(doc, d); y = 160; }

  // ----- Totaux -----
  const ligne = (lib, val, gras = false) => {
    doc.fillColor(GRIS_T).font('Helvetica').fontSize(8.5).text(lib, 300, y, { width: 150, align: 'right', lineBreak: false });
    doc.fillColor(TEXTE).font(gras ? 'Helvetica-Bold' : 'Helvetica').text(val, 440, y, { width: R - 440 - 10, align: 'right', lineBreak: false });
    y += 18;
  };
  const sous = d.lignes.reduce((a, l) => a + Number(l.normal) * Number(l.qte), 0);
  const remise = sous - Number(d.total);
  ligne('Sous-total (prix normaux)', gnf(sous));
  if (remise > 0) ligne('Remise accordée', `- ${gnf(remise)}`);
  y += 4;
  doc.rect(290, y, R - 290, 32).fill(NOIR);
  doc.fillColor(OR).font('Helvetica-Bold').fontSize(9.5).text('TOTAL À PAYER', 304, y + 12, { lineBreak: false });
  doc.text(gnf(d.total), 400, y + 12, { width: R - 400 - 14, align: 'right', lineBreak: false });
  y += 32 + 16;
  d.paiement.forEach(([lib, val]) => ligne(lib, val, true));

  // ----- Remerciement -----
  const yMerci = Math.max(y + 50, 640);
  doc.fillColor(TEXTE).font('Times-Italic').fontSize(12).text('Merci pour votre confiance.', 0, yMerci, { width: doc.page.width, align: 'center', lineBreak: false });
  doc.fillColor(GRIS_T).font('Helvetica').fontSize(7.5)
    .text('Les articles vendus ne sont ni repris ni échangés sans présentation de ce reçu.', 0, yMerci + 20, { width: doc.page.width, align: 'center', lineBreak: false });

  pied(doc);
}

function nouveauDocument() {
  return new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
}

function donneesVente(vente, boutique) {
  const lignes = (vente.DetailVentes || []).map((det) => {
    const produit = det.ProduitTaille.ProduitVariante.Produit;
    return {
      designation: `${produit.nom} (Taille ${det.ProduitTaille.taille})`,
      qte: det.quantite,
      normal: produit.prix_normal,
      reduit: det.prix_applique,
      total: det.sous_total,
    };
  });
  return {
    boutique: { ...boutique.toJSON?.() ? boutique.toJSON() : boutique },
    titre: 'REÇU',
    numero: vente.numero_recu,
    date: dateFR(vente.date_vente).slice(0, 10),
    client: vente.Client?.nom || 'Client de passage',
    soustitre: 'Vente en boutique',
    lignes,
    total: vente.montant_total,
    paiement: [['Mode de paiement', vente.MoyenPaiement?.nom || '—']],
  };
}

function donneesCommandeSpeciale(c, boutique) {
  const paiements = c.paiements || [];
  const paye = paiements.reduce((a, p) => a + Number(p.montant), 0);
  const modes = [...new Set(paiements.map((p) => p.MoyenPaiement?.nom).filter(Boolean))].join(', ');
  const reste = Math.max(0, Number(c.prix_total) - paye);
  return {
    boutique: { ...boutique.toJSON?.() ? boutique.toJSON() : boutique },
    titre: 'REÇU',
    numero: `CS-${String(c.id).padStart(4, '0')}`,
    date: dateFR(c.created_at || new Date()).slice(0, 10),
    client: c.client_nom,
    soustitre: c.client_telephone ? `Commande spéciale · ${c.client_telephone}` : 'Commande spéciale',
    lignes: [{ designation: c.article + (c.details ? ` — ${c.details}` : ''), qte: 1, normal: c.prix_total, reduit: c.prix_total, total: c.prix_total }],
    total: c.prix_total,
    paiement: [
      ['Mode de paiement', modes || '—'],
      ['Acompte versé', gnf(paye)],
      ['Reste à payer', gnf(reste)],
    ],
  };
}

function ecrire(res, donnees, nomFichier) {
  const doc = nouveauDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nomFichier}"`);
  doc.pipe(res);
  dessinerRecu(doc, donnees);
  doc.end();
}

/** Génère un reçu de vente et l'enregistre dans /uploads/recus. Retourne le chemin relatif. */
function genererRecuPDF(vente, boutique) {
  const dossier = path.join(__dirname, '..', 'uploads', 'recus');
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
  const nomFichier = `recu-${vente.numero_recu}.pdf`;
  const doc = nouveauDocument();
  doc.pipe(fs.createWriteStream(path.join(dossier, nomFichier)));
  dessinerRecu(doc, donneesVente(vente, boutique));
  doc.end();
  return `/uploads/recus/${nomFichier}`;
}

const envoyerRecuPDF = (vente, boutique, res) => ecrire(res, donneesVente(vente, boutique), `recu-${vente.numero_recu}.pdf`);
const envoyerRecuCommandeSpeciale = (commande, boutique, res) => ecrire(res, donneesCommandeSpeciale(commande, boutique), `recu-commande-${commande.id}.pdf`);

module.exports = { genererRecuPDF, envoyerRecuPDF, envoyerRecuCommandeSpeciale };