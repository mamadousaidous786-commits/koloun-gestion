import api from './api';

// Commandes passées depuis l'application Koloun Boutique, en attente de confirmation
export const commandesAConfirmer = () => api.get('/boutique/admin/a-confirmer').then((r) => r.data);
export const accepterCommande = (id, donnees) => api.post(`/boutique/admin/commandes/${id}/accepter`, donnees).then((r) => r.data);
export const refuserCommande = (id, motif) => api.post(`/boutique/admin/commandes/${id}/refuser`, { motif }).then((r) => r.data);
