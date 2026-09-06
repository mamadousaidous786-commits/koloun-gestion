export function urlFichier(cheminRelatif) {
  if (!cheminRelatif) return null;
  if (cheminRelatif.startsWith('http')) return cheminRelatif; // déjà une URL Cloudinary complète
  const baseBackend = import.meta.env.VITE_API_URL || '';
  return `${baseBackend}${cheminRelatif}`;
}