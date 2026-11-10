// Les photos Cloudinary sont déjà des adresses complètes (https://...).
// Les anciennes photos locales (/uploads/...) passent par le serveur.
export function urlFichier(chemin) {
  if (!chemin) return null;
  if (/^https?:\/\//.test(chemin)) return chemin;
  const baseBackend = import.meta.env.VITE_API_URL || '';
  return `${baseBackend}${chemin}`;
}
