// Saisie rapide des tailles : « 30-34:1, 36:2, 40 » → [{taille:'30',quantite:1}, …, {taille:'36',quantite:2}, {taille:'40',quantite:1}]
// Comprend : plages numériques (30-34, 30 à 34, 30-40/2 = de 2 en 2), plages de lettres (S-XL),
// quantité après « : », « = » ou « x » (36x2). Sans quantité : 1 pièce.
const LETTRES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
const ALIAS = { '2XL': 'XXL', XXXL: '3XL', XXXXL: '4XL' };
const lettre = (t) => { const u = t.toUpperCase(); return ALIAS[u] || u; };
// (écrit ainsi pour que Tailwind ne le prenne pas pour une classe CSS)
const AUTOUR_DES_SIGNES = new RegExp('\\s*([' + '-:=/' + '])\\s*', 'g');
const nombre = (t) => (/^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : null);
const ecrire = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));

export function lireSaisieTailles(texte) {
  const propre = String(texte || '')
    .replace(/\s+(?:à|a|au)\s+/gi, '-')            // 30 à 34 → 30-34
    .replace(/(\S)\s*[x×]\s*(\d+)\b/gi, '$1:$2')     // 36x2 → 36:2
    .replace(AUTOUR_DES_SIGNES, '$1');                // espaces autour des signes
  const morceaux = propre.split(/[,;\s]+/).filter(Boolean);
  const tailles = []; const erreurs = [];
  for (const m of morceaux) {
    const r = m.match(/^([A-Za-z0-9.]+?)(?:-([A-Za-z0-9.]+?))?(?:\/(\d+(?:[.,]\d+)?))?(?:[:=](\d+))?$/);
    if (!r) { erreurs.push(m); continue; }
    const [, debut, fin, pasTexte, qteTexte] = r;
    const quantite = qteTexte === undefined ? 1 : Number(qteTexte);
    let liste = [];
    if (!fin) {
      liste = [nombre(debut) !== null ? ecrire(nombre(debut)) : lettre(debut)];
    } else if (nombre(debut) !== null && nombre(fin) !== null) {
      const a = nombre(debut); const b = nombre(fin); const pas = pasTexte ? Number(pasTexte.replace(',', '.')) : 1;
      if (b < a || pas <= 0 || (b - a) / pas > 40) { erreurs.push(m); continue; }
      for (let v = a; v <= b + 1e-9; v += pas) liste.push(ecrire(v));
    } else {
      const ia = LETTRES.indexOf(lettre(debut)); const ib = LETTRES.indexOf(lettre(fin));
      if (ia < 0 || ib < 0 || ib < ia) { erreurs.push(m); continue; }
      liste = LETTRES.slice(ia, ib + 1);
    }
    liste.forEach((taille) => {
      const deja = tailles.find((t) => t.taille.toUpperCase() === taille.toUpperCase());
      if (deja) deja.quantite = quantite; else tailles.push({ taille, quantite });
    });
  }
  return { tailles, erreurs };
}

// Ajoute les tailles saisies aux lignes existantes : même taille = quantité remplacée, sinon nouvelle ligne.
// Les lignes vides sont retirées ; les lignes déjà en base gardent leur identifiant.
export function fusionnerTailles(actuelles, nouvelles) {
  const resultat = actuelles.filter((t) => String(t.taille).trim() !== '').map((t) => ({ ...t }));
  nouvelles.forEach((n) => {
    const ligne = resultat.find((t) => String(t.taille).trim().toUpperCase() === n.taille.toUpperCase());
    if (ligne) ligne.quantite = n.quantite; else resultat.push({ taille: n.taille, quantite: n.quantite });
  });
  return resultat.length ? resultat : [{ taille: '', quantite: '' }];
}
