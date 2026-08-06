// En local : proxy Vite gère /uploads. En production : préfixe avec l'URL du backend (VITE_API_URL)
export function urlFichier(cheminRelatif) {
  if (!cheminRelatif) return null;
  const baseBackend = import.meta.env.VITE_API_URL || '';
  return `${baseBackend}${cheminRelatif}`;
}
