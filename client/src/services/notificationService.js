import api from './api';

export const listerNotifications = () => api.get('/notifications').then((r) => r.data);
export const marquerLue = (id) => api.put(`/notifications/${id}/lue`).then((r) => r.data);
export const supprimerNotification = (id) => api.delete(`/notifications/${id}`).then((r) => r.data);
export const supprimerToutesNotifications = () => api.delete('/notifications').then((r) => r.data);
