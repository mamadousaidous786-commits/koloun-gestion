import api from './api';

export const listerCommandesSpeciales = (params) => api.get('/commandes-speciales', { params }).then((r) => r.data);
export const creerCommandeSpeciale = (formData) => api.post('/commandes-speciales', formData).then((r) => r.data);
export const changerStatutCommandeSpeciale = (id, statut) => api.put(`/commandes-speciales/${id}/statut`, { statut }).then((r) => r.data);
export const ajouterPaiementCommandeSpeciale = (id, d) => api.post(`/commandes-speciales/${id}/paiements`, d).then((r) => r.data);
export const supprimerCommandeSpeciale = (id) => api.delete(`/commandes-speciales/${id}`).then((r) => r.data);
