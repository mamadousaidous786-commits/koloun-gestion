import api from './api';

export const listerDepenses = (params) => api.get('/depenses', { params }).then((r) => r.data);
export const creerDepense = (d) => api.post('/depenses', d).then((r) => r.data);
export const supprimerDepense = (id) => api.delete(`/depenses/${id}`).then((r) => r.data);
