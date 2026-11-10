import React, { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import RouteProtegee from './components/RouteProtegee';
import LayoutPrincipal from './layouts/LayoutPrincipal';

import Connexion from './pages/Connexion';
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin'));
const DashboardUtilisateur = lazy(() => import('./pages/DashboardUtilisateur'));
const Produits = lazy(() => import('./pages/Produits'));
const Ventes = lazy(() => import('./pages/Ventes'));
const Commandes = lazy(() => import('./pages/Commandes'));
const Utilisateurs = lazy(() => import('./pages/Utilisateurs'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Statistiques = lazy(() => import('./pages/Statistiques'));
const CommandesSpeciales = lazy(() => import('./pages/CommandesSpeciales'));
const Clients = lazy(() => import('./pages/Clients'));
const Dettes = lazy(() => import('./pages/Dettes'));
const Depenses = lazy(() => import('./pages/Depenses'));
const Cloture = lazy(() => import('./pages/Cloture'));
const Rapport = lazy(() => import('./pages/Rapport'));
const Sauvegarde = lazy(() => import('./pages/Sauvegarde'));

// Télécharge toutes les pages en arrière-plan : les changements d'onglet sont instantanés
const precharger = () => Promise.all([
  import('./pages/DashboardAdmin'),
  import('./pages/DashboardUtilisateur'),
  import('./pages/Produits'),
  import('./pages/Ventes'),
  import('./pages/Commandes'),
  import('./pages/Utilisateurs'),
  import('./pages/Comptabilite'),
  import('./pages/Notifications'),
  import('./pages/Statistiques'),
  import('./pages/CommandesSpeciales'),
  import('./pages/Clients'),
  import('./pages/Dettes'),
  import('./pages/Depenses'),
  import('./pages/Cloture'),
  import('./pages/Rapport'),
  import('./pages/Sauvegarde')
]).catch(() => {});
if (typeof window !== 'undefined') {
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(precharger);
}

function TableauDeBordRouteur() {
  const { estAdmin } = useAuth();
  return estAdmin ? <DashboardAdmin /> : <DashboardUtilisateur />;
}

const Admin = ({ children }) => <RouteProtegee adminUniquement>{children}</RouteProtegee>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer theme="light" position="top-right" autoClose={3000} />
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route element={<RouteProtegee><LayoutPrincipal /></RouteProtegee>}>
            <Route path="/tableau-de-bord" element={<TableauDeBordRouteur />} />
            <Route path="/produits" element={<Produits />} />
            <Route path="/ventes" element={<Ventes />} />
            <Route path="/commandes-speciales" element={<CommandesSpeciales />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/notifications" element={<Notifications />} />

            {/* Réservé à l'administrateur */}
            <Route path="/dettes" element={<Admin><Dettes /></Admin>} />
            <Route path="/depenses" element={<Admin><Depenses /></Admin>} />
            <Route path="/comptabilite" element={<Admin><Comptabilite /></Admin>} />
            <Route path="/cloture" element={<Admin><Cloture /></Admin>} />
            <Route path="/rapport" element={<Admin><Rapport /></Admin>} />
            <Route path="/commandes" element={<Admin><Commandes /></Admin>} />
            <Route path="/statistiques" element={<Admin><Statistiques /></Admin>} />
            <Route path="/utilisateurs" element={<Admin><Utilisateurs /></Admin>} />
            <Route path="/sauvegarde" element={<Admin><Sauvegarde /></Admin>} />
          </Route>

          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
