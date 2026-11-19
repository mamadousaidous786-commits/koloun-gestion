import api from './api';
import { compresserImage } from '../utils/images';

// Envoi avec photos : photos réduites (~300 Ko au lieu de 3 à 8 Mo), délai long et progression affichée
const optionsEnvoi = (onProgression) => ({
  timeout: 5 * 60 * 1000,
  onUploadProgress: (e) => onProgression?.(e.total ? Math.round((e.loaded / e.total) * 100) : null),
});
const reduire = async (variantes) => Promise.all(variantes.map(async (v) => (v.fichier instanceof File ? { ...v, fichier: await compresserImage(v.fichier) } : v)));

export const listerProduits = (params) => api.get('/produits', { params }).then((r) => r.data);
export const obtenirProduit = (id) => api.get(`/produits/${id}`).then((r) => r.data);

// Création : chaque variante (photo) envoyée dans "images" a ses infos alignées par ordre dans "variantes"
export const creerProduit = async (donnees, onProgression) => {
  const variantes = await reduire(donnees.variantes);
  const formData = new FormData();
  if (donnees.cle_envoi) formData.append('cle_envoi', donnees.cle_envoi);
  formData.append('annoncer', donnees.annoncer === false ? '0' : '1'); // notification « Nouvel arrivage » aux clients de Koloun Boutique
  formData.append('nom', donnees.nom);
  formData.append('prix_normal', donnees.prix_normal);
  formData.append('description', donnees.description || '');
  formData.append('variantes', JSON.stringify(variantes.map((v) => ({ tailles: v.tailles }))));
  variantes.forEach((v) => {
    if (v.fichier instanceof File) formData.append('images', v.fichier);
  });
  return api.post('/produits', formData, optionsEnvoi(onProgression)).then((r) => r.data);
};

// Modification : sépare variantes existantes (tailles modifiables), variantes à supprimer, et nouvelles variantes (nouvelles photos)
export const modifierProduit = async (id, donnees, onProgression) => {
  const nouvelles = await reduire(donnees.nouvellesVariantes || []);
  const formData = new FormData();
  formData.append('nom', donnees.nom);
  formData.append('prix_normal', donnees.prix_normal);
  formData.append('description', donnees.description || '');
  formData.append('variantes_existantes', JSON.stringify(donnees.variantesExistantes || []));
  formData.append('variantes_a_supprimer', JSON.stringify(donnees.variantesASupprimer || []));
  formData.append('nouvelles_variantes', JSON.stringify(nouvelles.map((v) => ({ tailles: v.tailles }))));
  nouvelles.forEach((v) => {
    if (v.fichier instanceof File) formData.append('images', v.fichier);
  });
  return api.put(`/produits/${id}`, formData, optionsEnvoi(onProgression)).then((r) => r.data);
};

// Nombre de téléphones clients prévenus des nouveaux arrivages
export const abonnesArrivages = () => api.get('/boutique/admin/notifications').then((r) => r.data);

export const supprimerProduit = (id) => api.delete(`/produits/${id}`).then((r) => r.data);
export const dupliquerProduit = (id) => api.post(`/produits/${id}/dupliquer`).then((r) => r.data);
export const mouvementStockTaille = (tailleId, donnees) => api.post(`/produits/tailles/${tailleId}/stock`, donnees).then((r) => r.data);
