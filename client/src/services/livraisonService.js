import api from './api';

export const listerLivraisons = (jour) => api.get('/livraisons', { params: { jour } }).then((r) => r.data);
export const creerLivraison = (formData) => api.post('/livraisons', formData).then((r) => r.data);
export const modifierLivraison = (id, formData) => api.put(`/livraisons/${id}`, formData).then((r) => r.data);
// moyen_paiement_id : pour une commande en ligne livrée, la vente est enregistrée avec ce mode de paiement
export const changerStatutLivraison = (id, statut, motif, moyen_paiement_id) => api.put(`/livraisons/${id}/statut`, { statut, motif, moyen_paiement_id }).then((r) => r.data);
export const supprimerLivraison = (id) => api.delete(`/livraisons/${id}`).then((r) => r.data);
