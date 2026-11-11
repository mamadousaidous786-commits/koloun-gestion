const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO = path.join(__dirname, '..', 'assets', 'logo.jpeg');
const BLEU = '#1d4ed8';
const MARINE = '#0f2557';
const GRIS = '#64748b';
const LIGNE = '#e2e8f0';

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

/**
 * Dessine un reçu au format A5 (même présentation que le modèle validé) :
 * en-tête boutique, titre, informations, tableau, total, paiement, signatures, remerciement.
 *  donnees = { boutique, titre, infos:[[libellé, valeur]], lignes:[{designation, qte, pu, total}],
 *              total, paiement:[[libellé, valeur]] }
 */
function dessinerRecu(doc, d) {
  const L = 36;                       // marge gauche
  const R = doc.page.width - 36;      // marge droite
  const W = R - L;
  let y = 30;

  // ----- En-tête -----
  try { doc.save().circle(L + 24, y + 24, 24).clip().image(LOGO, L, y, { width: 48, height: 48 }).restore(); } catch (e) { /* logo absent */ }
  doc.fillColor(MARINE).font('Helvetica-Bold').fontSize(20).text(d.boutique.nom.toUpperCase(), L, y + 2, { width: W, align: 'center' });
  doc.fillColor(BLEU).font('Helvetica-Oblique').fontSize(10).text('Qualité & Élégance', L, y + 26, { width: W, align: 'center' });
  doc.fillColor(GRIS).font('Helvetica').fontSize(8)
    .text([propre(d.boutique.adresse), d.boutique.telephone].filter(Boolean).join('  •  '), L, y + 41, { width: W, align: 'center' });
  y += 62;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(2).strokeColor(BLEU).stroke();
  y += 14;

  // ----- Titre -----
  doc.roundedRect(L, y, W, 26, 4).fill(MARINE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(d.titre, L, y + 7.5, { width: W, align: 'center', characterSpacing: 1 });
  y += 40;

  // ----- Informations -----
  d.infos.forEach(([lib, val]) => {
    doc.fillColor(MARINE).font('Helvetica-Bold').fontSize(10).text(`${lib} :`, L, y, { continued: true });
    doc.fillColor('#111827').font('Helvetica').text(`  ${val}`);
    y += 16;
  });
  y += 8;

  // ----- Tableau -----
  const col = { n: L, des: L + 26, qte: L + W * 0.52, pu: L + W * 0.62, tot: L + W * 0.82 };
  const entete = () => {
    doc.rect(L, y, W, 22).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    doc.text('N°', col.n + 6, y + 7, { width: 20 });
    doc.text('Désignation', col.des, y + 7, { width: 150 });
    doc.text('Qté', col.qte, y + 7, { width: 30, align: 'center' });
    doc.text('Prix unitaire', col.pu, y + 7, { width: col.tot - col.pu - 6, align: 'right' });
    doc.text('Total (GNF)', col.tot, y + 7, { width: R - col.tot - 6, align: 'right' });
    y += 22;
  };
  entete();
  d.lignes.forEach((l, i) => {
    const hauteur = Math.max(20, doc.heightOfString(l.designation, { width: col.qte - col.des - 8 }) + 10);
    if (y + hauteur > doc.page.height - 70) { doc.addPage(); y = 36; entete(); }
    if (i % 2 === 1) doc.rect(L, y, W, hauteur).fill('#f1f5f9');
    doc.fillColor('#111827').font('Helvetica').fontSize(9);
    doc.text(String(i + 1), col.n + 6, y + 6, { width: 20 });
    doc.text(l.designation, col.des, y + 6, { width: col.qte - col.des - 8 });
    doc.text(String(l.qte), col.qte, y + 6, { width: 30, align: 'center' });
    doc.text(nombre(l.pu), col.pu, y + 6, { width: col.tot - col.pu - 6, align: 'right' });
    doc.font('Helvetica-Bold').text(nombre(l.total), col.tot, y + 6, { width: R - col.tot - 6, align: 'right' });
    y += hauteur;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LIGNE).stroke();
  });
  y += 12;

  // Place nécessaire pour la fin (total + paiement + signatures) : sinon nouvelle page
  const besoin = 40 + d.paiement.length * 16 + 110;
  if (y + besoin > doc.page.height - 30) { doc.addPage(); y = 36; }

  // ----- Total -----
  doc.roundedRect(L + W * 0.45, y, W * 0.55, 30, 5).fill(BLEU);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
    .text(`TOTAL À PAYER : ${gnf(d.total)}`, L + W * 0.45, y + 9, { width: W * 0.55, align: 'center' });
  y += 46;

  // ----- Paiement -----
  d.paiement.forEach(([lib, val]) => {
    doc.fillColor(MARINE).font('Helvetica-Bold').fontSize(10).text(`${lib} :`, L, y, { continued: true });
    doc.fillColor('#111827').font('Helvetica').text(`  ${val}`);
    y += 16;
  });
  y += 22;

  // ----- Signatures -----
  const moitie = W / 2 - 12;
  doc.fillColor(MARINE).font('Helvetica-Bold').fontSize(9);
  doc.text('Signature du client', L, y, { width: moitie });
  doc.text('Cachet / Signature de la boutique', L + W / 2 + 12, y, { width: moitie });
  doc.moveTo(L, y + 44).lineTo(L + moitie, y + 44).lineWidth(0.7).strokeColor(GRIS).stroke();
  doc.moveTo(L + W / 2 + 12, y + 44).lineTo(R, y + 44).stroke();
  y += 62;

  doc.fillColor(BLEU).font('Helvetica-Oblique').fontSize(11).text('Merci pour votre confiance !', L, y, { width: W, align: 'center' });
}

function nouveauDocument() {
  return new PDFDocument({ size: 'A5', margin: 0, autoFirstPage: true });
}

function donneesVente(vente, boutique) {
  const lignes = (vente.DetailVentes || []).map((det) => ({
    designation: `${det.ProduitTaille.ProduitVariante.Produit.nom} (Taille ${det.ProduitTaille.taille})`,
    qte: det.quantite,
    pu: det.prix_applique,
    total: det.sous_total,
  }));
  const vendeur = vente.Utilisateur ? `${vente.Utilisateur.prenom || ''} ${vente.Utilisateur.nom}`.trim() : '';
  return {
    boutique,
    titre: 'REÇU DE VENTE',
    infos: [
      ['N° du reçu', vente.numero_recu],
      ['Date', dateFR(vente.date_vente)],
      ['Client', vente.Client?.nom || 'Client de passage'],
      ['Type', 'Vente'],
      ...(vendeur ? [['Vendeur', vendeur]] : []),
    ],
    lignes,
    total: vente.montant_total,
    paiement: [
      ['Mode de paiement', vente.MoyenPaiement?.nom || '—'],
      ['Montant réglé', gnf(vente.montant_total)],
      ['Reste à payer', gnf(0)],
    ],
  };
}

function donneesCommandeSpeciale(c, boutique) {
  const paiements = c.paiements || [];
  const paye = paiements.reduce((a, p) => a + Number(p.montant), 0);
  const modes = [...new Set(paiements.map((p) => p.MoyenPaiement?.nom).filter(Boolean))].join(', ');
  const reste = Math.max(0, Number(c.prix_total) - paye);
  return {
    boutique,
    titre: 'REÇU DE COMMANDE SPÉCIALE',
    infos: [
      ['Date', dateFR(c.created_at || new Date())],
      ['Client', c.client_nom],
      ...(c.client_telephone ? [['Téléphone', c.client_telephone]] : []),
      ['Type', 'Commande spéciale'],
    ],
    lignes: [{ designation: c.article + (c.details ? ` — ${c.details}` : ''), qte: 1, pu: c.prix_total, total: c.prix_total }],
    total: c.prix_total,
    paiement: [
      ['Mode de paiement', modes || '—'],
      ['Acompte versé', paye > 0 ? gnf(paye) : '0 GNF'],
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
