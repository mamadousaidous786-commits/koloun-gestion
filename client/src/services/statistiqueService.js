import api from './api';

export const dashboardAdmin = () => api.get('/statistiques/dashboard-admin').then((r) => r.data);
export const dashboardUtilisateur = () => api.get('/statistiques/dashboard-utilisateur').then((r) => r.data);
export const produitsPlusVendus = () => api.get('/statistiques/produits-plus-vendus').then((r) => r.data);
export const rechercheIntelligente = (terme) => api.get('/statistiques/recherche', { params: { terme } }).then((r) => r.data);
export const comptabilite = (date) => api.get('/statistiques/comptabilite', { params: { date } }).then((r) => r.data);
