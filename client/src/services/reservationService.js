import api from './api';

export const listerReservations = (params) => api.get('/reservations', { params }).then((r) => r.data);
export const creerReservation = (donnees) => api.post('/reservations', donnees).then((r) => r.data);
// prix : { [article_id]: prix final } si le prix change au moment du retrait
export const retirerReservation = (id, moyen_paiement_id, prix) => api.put(`/reservations/${id}/retrait`, { moyen_paiement_id, prix }).then((r) => r.data);
export const annulerReservation = (id, motif) => api.put(`/reservations/${id}/annuler`, { motif }).then((r) => r.data);
