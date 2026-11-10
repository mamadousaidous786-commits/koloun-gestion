// Photos Cloudinary : adresse complète, réduite et compressée automatiquement (chargement très rapide).
// Anciennes photos locales (/uploads/...) : passent par le serveur.
export function urlFichier(chemin, largeur = 500) {
  if (!chemin) return null;
  if (/^https?:\/\//.test(chemin)) {
    if (chemin.includes('res.cloudinary.com') && chemin.includes('/upload/') && !chemin.includes('/upload/f_auto')) {
      return chemin.replace('/upload/', `/upload/f_auto,q_auto,w_${largeur},c_limit/`);
    }
    return chemin;
  }
  const baseBackend = import.meta.env.VITE_API_URL || '';
  return `${baseBackend}${chemin}`;
}
