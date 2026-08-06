import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FiGrid, FiBox, FiShoppingCart, FiUsers, FiTruck,
  FiBarChart2, FiBell, FiLogOut, FiDollarSign, FiMenu, FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpeg';

export default function LayoutPrincipal() {
  const { utilisateur, deconnexion, estAdmin } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const lienClasse = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm font-medium ${
      isActive
        ? 'bg-or-500/15 text-or-300 border border-or-600/30'
        : 'text-charbon-100/70 hover:bg-charbon-800 hover:text-or-200'
    }`;

  const fermerMenu = () => setMenuOuvert(false);

  return (
    <div className="flex min-h-screen bg-charbon-950">
      {menuOuvert && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={fermerMenu} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-charbon-900 border-r border-or-900/20 flex flex-col transition-transform duration-200
        ${menuOuvert ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-6 border-b border-or-900/20 md:flex-col md:justify-center">
          <div className="flex items-center gap-3 md:flex-col">
            <img src={logo} alt="Koloun Luxure" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-full" />
            <p className="text-xs text-or-300/70 tracking-widest md:mt-2">GESTION COMMERCIALE</p>
          </div>
          <button onClick={fermerMenu} className="md:hidden text-charbon-100/60">
            <FiX size={22} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <NavLink to="/tableau-de-bord" className={lienClasse} onClick={fermerMenu}><FiGrid /> Tableau de bord</NavLink>
          <NavLink to="/produits" className={lienClasse} onClick={fermerMenu}><FiBox /> Produits</NavLink>
          <NavLink to="/ventes" className={lienClasse} onClick={fermerMenu}><FiShoppingCart /> Ventes</NavLink>
          {estAdmin && (
            <>
              <NavLink to="/commandes" className={lienClasse} onClick={fermerMenu}><FiTruck /> Commandes</NavLink>
              <NavLink to="/utilisateurs" className={lienClasse} onClick={fermerMenu}><FiUsers /> Utilisateurs</NavLink>
              <NavLink to="/comptabilite" className={lienClasse} onClick={fermerMenu}><FiDollarSign /> Comptabilité</NavLink>
              <NavLink to="/statistiques" className={lienClasse} onClick={fermerMenu}><FiBarChart2 /> Statistiques</NavLink>
            </>
          )}
          <NavLink to="/notifications" className={lienClasse} onClick={fermerMenu}><FiBell /> Notifications</NavLink>
        </nav>

        <div className="p-4 border-t border-or-900/20">
          <p className="text-sm text-charbon-50 font-medium">{utilisateur?.nom} {utilisateur?.prenom}</p>
          <p className="text-xs text-or-300/60 mb-3 capitalize">{utilisateur?.role} · {utilisateur?.boutique}</p>
          <button onClick={deconnexion} className="btn-secondary w-full flex items-center justify-center gap-2">
            <FiLogOut /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-charbon-900 border-b border-or-900/20 sticky top-0 z-30">
          <button onClick={() => setMenuOuvert(true)} className="text-charbon-100/70">
            <FiMenu size={22} />
          </button>
          <img src={logo} alt="Koloun Luxure" className="w-8 h-8 object-contain rounded-full" />
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
