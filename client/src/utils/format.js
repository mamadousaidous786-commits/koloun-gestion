export const formaterGNF = (n) => `${Number(n || 0).toLocaleString('fr-FR')} GNF`;

export const formaterDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export const aujourdhui = () => new Date().toISOString().slice(0, 10);
export const moisCourant = () => new Date().toISOString().slice(0, 7);

// Numéro guinéen (9 chiffres) -> format international sans "+" pour WhatsApp
export function numeroInternational(tel) {
  let chiffres = String(tel || '').replace(/\D/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  if (chiffres.length === 9) chiffres = `224${chiffres}`;
  return chiffres;
}

export const lienWhatsApp = (tel, message = '') =>
  `https://wa.me/${numeroInternational(tel)}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

export const lienAppel = (tel) => `tel:${String(tel || '').replace(/\s/g, '')}`;
