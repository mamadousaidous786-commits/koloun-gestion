import api from './api';

export const listerVentes = (params) => api.get('/ventes', { params }).then((r) => r.data);
export const obtenirVente = (id) => api.get(`/ventes/${id}`).then((r) => r.data);
export const creerVente = (donnees) => api.post('/ventes', donnees).then((r) => r.data);
export const genererRecu = (venteId) => api.get(`/recus/${venteId}/pdf`).then((r) => r.data);
export const supprimerVente = (id) => api.delete(`/ventes/${id}`).then((r) => r.data);
