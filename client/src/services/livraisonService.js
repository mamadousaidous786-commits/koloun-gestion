import api from './api';

export const listerLivraisons = (jour) => api.get('/livraisons', { params: { jour } }).then((r) => r.data);
export const creerLivraison = (formData) => api.post('/livraisons', formData).then((r) => r.data);
export const modifierLivraison = (id, formData) => api.put(`/livraisons/${id}`, formData).then((r) => r.data);
export const changerStatutLivraison = (id, statut, motif) => api.put(`/livraisons/${id}/statut`, { statut, motif }).then((r) => r.data);
export const supprimerLivraison = (id) => api.delete(`/livraisons/${id}`).then((r) => r.data);
