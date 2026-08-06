import api from './api';

export const listerProduits = (params) => api.get('/produits', { params }).then((r) => r.data);
export const obtenirProduit = (id) => api.get(`/produits/${id}`).then((r) => r.data);

// Création : chaque variante (photo) envoyée dans "images" a ses infos alignées par ordre dans "variantes"
export const creerProduit = (donnees) => {
  const formData = new FormData();
  formData.append('nom', donnees.nom);
  formData.append('prix_normal', donnees.prix_normal);
  formData.append('description', donnees.description || '');
  formData.append('variantes', JSON.stringify(donnees.variantes.map((v) => ({ tailles: v.tailles }))));
  donnees.variantes.forEach((v) => {
    if (v.fichier instanceof File) formData.append('images', v.fichier);
  });
  return api.post('/produits', formData).then((r) => r.data);
};

// Modification : sépare variantes existantes (tailles modifiables), variantes à supprimer, et nouvelles variantes (nouvelles photos)
export const modifierProduit = (id, donnees) => {
  const formData = new FormData();
  formData.append('nom', donnees.nom);
  formData.append('prix_normal', donnees.prix_normal);
  formData.append('description', donnees.description || '');
  formData.append('variantes_existantes', JSON.stringify(donnees.variantesExistantes || []));
  formData.append('variantes_a_supprimer', JSON.stringify(donnees.variantesASupprimer || []));
  formData.append('nouvelles_variantes', JSON.stringify((donnees.nouvellesVariantes || []).map((v) => ({ tailles: v.tailles }))));
  (donnees.nouvellesVariantes || []).forEach((v) => {
    if (v.fichier instanceof File) formData.append('images', v.fichier);
  });
  return api.put(`/produits/${id}`, formData).then((r) => r.data);
};

export const supprimerProduit = (id) => api.delete(`/produits/${id}`).then((r) => r.data);
export const dupliquerProduit = (id) => api.post(`/produits/${id}/dupliquer`).then((r) => r.data);
export const mouvementStockTaille = (tailleId, donnees) => api.post(`/produits/tailles/${tailleId}/stock`, donnees).then((r) => r.data);
