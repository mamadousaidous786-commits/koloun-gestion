import api from './api';

export const apercuCloture = (date) => api.get('/clotures/apercu', { params: { date } }).then((r) => r.data);
export const enregistrerCloture = (d) => api.post('/clotures', d).then((r) => r.data);
export const listerClotures = () => api.get('/clotures').then((r) => r.data);
export const supprimerCloture = (id) => api.delete(`/clotures/${id}`).then((r) => r.data);
