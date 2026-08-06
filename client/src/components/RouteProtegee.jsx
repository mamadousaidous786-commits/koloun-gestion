import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RouteProtegee({ children, adminUniquement = false }) {
  const { utilisateur, estAdmin } = useAuth();

  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (adminUniquement && !estAdmin) return <Navigate to="/tableau-de-bord" replace />;

  return children;
}
