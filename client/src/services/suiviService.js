import api from './api';

export const consulterSuivi = (code) => api.get(`/suivi/${code}`).then((r) => r.data);
