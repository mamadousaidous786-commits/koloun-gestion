import axios from 'axios';

// En local : proxy Vite ('/api'). En production : URL Render définie dans .env (VITE_API_URL)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
});

// Attache automatiquement le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('koloun_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Déconnecte automatiquement si le token est invalide/expiré
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('koloun_token');
      localStorage.removeItem('koloun_utilisateur');
      window.location.href = '/connexion';
    }
    return Promise.reject(error);
  }
);

export default api;
