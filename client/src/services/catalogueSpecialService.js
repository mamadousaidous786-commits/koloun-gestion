import api from './api';

// Modèles proposés en commande spéciale dans l'application client Koloun Boutique
export const listerModelesSpeciaux = () => api.get('/boutique/admin/speciales').then((r) => r.data);
export const publierModeleSpecial = (formData) => api.post('/boutique/admin/speciales', formData).then((r) => r.data);
export const modifierModeleSpecial = (id, formData) => api.put(`/boutique/admin/speciales/${id}`, formData).then((r) => r.data);
export const retirerModeleSpecial = (id) => api.delete(`/boutique/admin/speciales/${id}`).then((r) => r.data);
