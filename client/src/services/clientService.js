import api from './api';

export const listerClients = (q) => api.get('/clients', { params: { q } }).then((r) => r.data);
export const obtenirClient = (id) => api.get(`/clients/${id}`).then((r) => r.data);
export const creerClient = (d) => api.post('/clients', d).then((r) => r.data);
export const modifierClient = (id, d) => api.put(`/clients/${id}`, d).then((r) => r.data);
export const supprimerClient = (id) => api.delete(`/clients/${id}`).then((r) => r.data);
