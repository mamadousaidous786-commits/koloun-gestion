import api from './api';

export const listerUtilisateurs = () => api.get('/utilisateurs').then((r) => r.data);
export const creerUtilisateur = (donnees) => api.post('/utilisateurs', donnees).then((r) => r.data);
export const modifierUtilisateur = (id, donnees) => api.put(`/utilisateurs/${id}`, donnees).then((r) => r.data);
export const changerStatutUtilisateur = (id) => api.put(`/utilisateurs/${id}/statut`).then((r) => r.data);
export const supprimerUtilisateur = (id) => api.delete(`/utilisateurs/${id}`).then((r) => r.data);
