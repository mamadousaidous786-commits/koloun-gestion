import api from './api';

export const listerCommandes = (params) => api.get('/commandes', { params }).then((r) => r.data);
export const creerCommande = (donnees) => api.post('/commandes', donnees).then((r) => r.data);
export const mettreAJourTransport = (id, transport) => api.put(`/commandes/${id}/transport`, { transport }).then((r) => r.data);
export const mettreAJourRentabilite = (id, montant_realise) => api.put(`/commandes/${id}/montant-realise`, { montant_realise }).then((r) => r.data);
export const supprimerCommande = (id) => api.delete(`/commandes/${id}`).then((r) => r.data);
