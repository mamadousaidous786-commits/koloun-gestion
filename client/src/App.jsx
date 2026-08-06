import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import RouteProtegee from './components/RouteProtegee';
import LayoutPrincipal from './layouts/LayoutPrincipal';

import Connexion from './pages/Connexion';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardUtilisateur from './pages/DashboardUtilisateur';
import Produits from './pages/Produits';
import Ventes from './pages/Ventes';
import Commandes from './pages/Commandes';
import Utilisateurs from './pages/Utilisateurs';
import Comptabilite from './pages/Comptabilite';
import Notifications from './pages/Notifications';
import Statistiques from './pages/Statistiques';

function TableauDeBordRouteur() {
  const { estAdmin } = useAuth();
  return estAdmin ? <DashboardAdmin /> : <DashboardUtilisateur />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer theme="dark" position="top-right" autoClose={3000} />
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route
            element={
              <RouteProtegee>
                <LayoutPrincipal />
              </RouteProtegee>
            }
          >
            <Route path="/tableau-de-bord" element={<TableauDeBordRouteur />} />
            <Route path="/produits" element={<Produits />} />
            <Route path="/ventes" element={<Ventes />} />
            <Route path="/commandes" element={<RouteProtegee adminUniquement><Commandes /></RouteProtegee>} />
            <Route path="/utilisateurs" element={<RouteProtegee adminUniquement><Utilisateurs /></RouteProtegee>} />
            <Route path="/comptabilite" element={<RouteProtegee adminUniquement><Comptabilite /></RouteProtegee>} />
            <Route path="/statistiques" element={<RouteProtegee adminUniquement><Statistiques /></RouteProtegee>} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
