import api from './api';

export const etatAgent = () => api.get('/agent/etat').then((r) => r.data);
export const parlerAgent = (texte, session) => api.post('/agent/test', { texte, session }, { timeout: 90000 }).then((r) => r.data);
export const rendreLaMainAgent = (session) => api.post('/agent/test/reprendre', { session }).then((r) => r.data);
export const demandesAgent = (statut) => api.get('/agent/demandes', { params: { statut } }).then((r) => r.data);
export const traiterDemandeAgent = (id, statut) => api.put(`/agent/demandes/${id}`, { statut }).then((r) => r.data);
