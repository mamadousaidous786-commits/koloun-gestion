import api from './api';

export const listerCommandesSpeciales = (params) => api.get('/commandes-speciales', { params }).then((r) => r.data);
export const creerCommandeSpeciale = (formData) => api.post('/commandes-speciales', formData).then((r) => r.data);
export const changerStatutCommandeSpeciale = (id, statut) => api.put(`/commandes-speciales/${id}/statut`, { statut }).then((r) => r.data);
export const ajouterPaiementCommandeSpeciale = (id, d) => api.post(`/commandes-speciales/${id}/paiements`, d).then((r) => r.data);
export const supprimerCommandeSpeciale = (id) => api.delete(`/commandes-speciales/${id}`).then((r) => r.data);

// Reçu PDF (acompte + reste) : récupéré avec le jeton de connexion puis ouvert dans un onglet
export const recuCommandeSpeciale = async (id) => {
  const rep = await api.get(`/commandes-speciales/${id}/recu`, { responseType: 'blob' });
  return URL.createObjectURL(new Blob([rep.data], { type: 'application/pdf' }));
};
