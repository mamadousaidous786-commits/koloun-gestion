import api from './api';

export const listerDettes = (params) => api.get('/dettes', { params }).then((r) => r.data);
export const creerDette = (d) => api.post('/dettes', d).then((r) => r.data);
export const ajouterPaiementDette = (id, d) => api.post(`/dettes/${id}/paiements`, d).then((r) => r.data);
export const supprimerPaiementDette = (id, paiementId) => api.delete(`/dettes/${id}/paiements/${paiementId}`).then((r) => r.data);
export const supprimerDette = (id) => api.delete(`/dettes/${id}`).then((r) => r.data);
