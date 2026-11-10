import api, { viderCache, prechargerDonnees } from './api';

export const connexion = async (email, mot_de_passe) => {
  const { data } = await api.post('/auth/login', { email, mot_de_passe });
  localStorage.setItem('koloun_token', data.token);
  localStorage.setItem('koloun_utilisateur', JSON.stringify(data.utilisateur));
  prechargerDonnees(); // les pages suivantes s'ouvrent instantanément
  return data.utilisateur;
};

export const deconnexion = () => {
  localStorage.removeItem('koloun_token');
  localStorage.removeItem('koloun_utilisateur');
  viderCache();
};

export const utilisateurCourant = () => {
  try {
    const donnees = localStorage.getItem('koloun_utilisateur');
    return donnees && localStorage.getItem('koloun_token') ? JSON.parse(donnees) : null;
  } catch {
    return null;
  }
};
