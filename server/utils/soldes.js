// Calculs de soldes pour les commandes spéciales et les dettes

const somme = (paiements) => (paiements || []).reduce((acc, p) => acc + Number(p.montant), 0);

function avecSoldeCommande(instance) {
  const c = typeof instance.toJSON === 'function' ? instance.toJSON() : instance;
  const paye = somme(c.paiements);
  c.total_paye = paye;
  c.reste = Math.max(0, Number(c.prix_total) - paye);
  return c;
}

function avecSoldeDette(instance) {
  const d = typeof instance.toJSON === 'function' ? instance.toJSON() : instance;
  const paye = somme(d.paiements);
  d.total_paye = paye;
  d.reste = Math.max(0, Number(d.montant_initial) - paye);
  d.soldee = d.reste === 0;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  d.en_retard = !d.soldee && !!d.date_echeance && String(d.date_echeance).slice(0, 10) < aujourdhui;
  return d;
}

module.exports = { somme, avecSoldeCommande, avecSoldeDette };
