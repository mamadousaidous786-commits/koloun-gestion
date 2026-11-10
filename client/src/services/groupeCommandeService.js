import api from './api';

export const listerGroupes = () => api.get('/groupes-commande').then((r) => r.data);
export const creerGroupe = (donnees) => api.post('/groupes-commande', donnees).then((r) => r.data);
export const validerTransportGroupe = (id, transport) => api.put(`/groupes-commande/${id}/transport`, { transport }).then((r) => r.data);
export const supprimerGroupe = (id) => api.delete(`/groupes-commande/${id}`).then((r) => r.data);
