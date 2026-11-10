import axios from 'axios';

// En local : proxy Vite ('/api'). En production : URL Render définie dans .env (VITE_API_URL)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 60000, // laisse le temps au serveur gratuit de se réveiller
});

// Attache automatiquement le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('koloun_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ------------------------------------------------------------------ */
/*  Cache des lectures (GET) : les pages s'affichent instantanément    */
/* ------------------------------------------------------------------ */
const cache = new Map();      // clé -> { data, t }
const enCours = new Map();    // clé -> promesse (évite les doublons)
const FRAIS_MS = 10 * 1000;           // < 10 s : aucune requête
const PERIME_MS = 10 * 60 * 1000;     // < 10 min : affiché tout de suite + rafraîchi en arrière-plan
const SANS_CACHE_PERIME = /^\/(statistiques|rapports|clotures|notifications)/; // chiffres : toujours revérifiés

const cle = (url, params) => {
  const p = Object.entries(params || {})
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .sort(([a], [b]) => (a > b ? 1 : -1));
  return `${url}?${JSON.stringify(p)}`;
};

export const viderCache = () => { cache.clear(); enCours.clear(); };

const getReseau = (url, config, k) => {
  if (enCours.has(k)) return enCours.get(k);
  const promesse = originalGet(url, config)
    .then((rep) => { cache.set(k, { data: rep.data, t: Date.now() }); return rep; })
    .finally(() => enCours.delete(k));
  enCours.set(k, promesse);
  return promesse;
};

const originalGet = api.get.bind(api);
api.get = (url, config = {}) => {
  if (config.responseType === 'blob' || url.startsWith('/auth') || url.startsWith('/sauvegarde') || url.startsWith('/recus')) {
    return originalGet(url, config);
  }
  const k = cle(url, config.params);
  const trouve = cache.get(k);
  if (trouve) {
    const age = Date.now() - trouve.t;
    if (age < FRAIS_MS) return Promise.resolve({ data: trouve.data, status: 200, fromCache: true });
    if (age < PERIME_MS && !SANS_CACHE_PERIME.test(url)) {
      getReseau(url, config, k).catch(() => {}); // rafraîchit en silence
      return Promise.resolve({ data: trouve.data, status: 200, fromCache: true });
    }
  }
  return getReseau(url, config, k);
};

// Toute modification (vente, produit, paiement…) invalide le cache : données toujours justes
api.interceptors.response.use(
  (response) => {
    if (response.config && response.config.method !== 'get') viderCache();
    return response;
  },
  (error) => {
    const statut = error.response?.status;
    const message = error.response?.data?.message || '';
    if (statut === 401 || (statut === 403 && /token/i.test(message))) {
      viderCache();
      localStorage.removeItem('koloun_token');
      localStorage.removeItem('koloun_utilisateur');
      if (!window.location.pathname.startsWith('/connexion')) window.location.replace('/connexion');
    }
    return Promise.reject(error);
  }
);

// Précharge les listes principales (appelé juste après la connexion)
export const prechargerDonnees = () => {
  ['/produits', '/clients', '/ventes'].forEach((u) => api.get(u).catch(() => {}));
};

export default api;
