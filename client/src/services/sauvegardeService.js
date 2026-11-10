import api from './api';

// Télécharge la sauvegarde complète (fichier JSON) et la propose à l'enregistrement
export async function telechargerSauvegarde() {
  const reponse = await api.get('/sauvegarde/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([reponse.data], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `sauvegarde-koloun-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}
