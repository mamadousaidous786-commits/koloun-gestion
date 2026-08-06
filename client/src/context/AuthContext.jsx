import React, { createContext, useContext, useState } from 'react';
import { connexion as connexionService, deconnexion as deconnexionService, utilisateurCourant } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(utilisateurCourant());

  const connexion = async (email, mot_de_passe) => {
    const donneesUtilisateur = await connexionService(email, mot_de_passe);
    setUtilisateur(donneesUtilisateur);
    return donneesUtilisateur;
  };

  const deconnexion = () => {
    deconnexionService();
    setUtilisateur(null);
  };

  const estAdmin = utilisateur?.role === 'admin';

  return (
    <AuthContext.Provider value={{ utilisateur, connexion, deconnexion, estAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
