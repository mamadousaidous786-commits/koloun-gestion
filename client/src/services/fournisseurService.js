import api from './api';

export const listerFournisseurs = () => api.get('/fournisseurs').then((r) => r.data);
export const creerFournisseur = (donnees) => api.post('/fournisseurs', donnees).then((r) => r.data);
export const supprimerFournisseur = (id) => api.delete(`/fournisseurs/${id}`).then((r) => r.data);
