import api from './api';

export const connexion = async (email, mot_de_passe) => {
  const { data } = await api.post('/auth/login', { email, mot_de_passe });
  localStorage.setItem('koloun_token', data.token);
  localStorage.setItem('koloun_utilisateur', JSON.stringify(data.utilisateur));
  return data.utilisateur;
};

export const deconnexion = () => {
  localStorage.removeItem('koloun_token');
  localStorage.removeItem('koloun_utilisateur');
};

export const utilisateurCourant = () => {
  const donnees = localStorage.getItem('koloun_utilisateur');
  return donnees ? JSON.parse(donnees) : null;
};
