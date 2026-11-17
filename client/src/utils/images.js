// Réduit une photo de téléphone (souvent 4 à 8 Mo) avant l'envoi : ~300 Ko suffisent pour la boutique.
// Envoi beaucoup plus rapide, surtout avec plusieurs photos et une connexion mobile.
export async function compresserImage(fichier, tailleMax = 1600, qualite = 0.82) {
  try {
    if (!(fichier instanceof File) || !fichier.type.startsWith('image/') || fichier.type === 'image/gif') return fichier;
    if (fichier.size < 400 * 1024) return fichier; // déjà légère
    const bitmap = await createImageBitmap(fichier);
    const ratio = Math.min(1, tailleMax / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualite));
    if (!blob || blob.size >= fichier.size) return fichier;
    return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return fichier; // format non lisible par le navigateur (ex. HEIC) : on envoie l'original
  }
}

export const compresserImages = (fichiers) => Promise.all(fichiers.map((f) => compresserImage(f)));
