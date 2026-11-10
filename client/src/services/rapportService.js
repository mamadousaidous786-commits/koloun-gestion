import api from './api';

export const rapportMensuel = (mois) => api.get('/rapports/mensuel', { params: { mois } }).then((r) => r.data);
