import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiBox, FiShoppingCart, FiUsers, FiTruck, FiBarChart2, FiBell, FiLogOut, FiDollarSign,
  FiMenu, FiX, FiStar, FiUser, FiCreditCard, FiFileText, FiLock, FiDatabase, FiTrendingDown,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpeg';
import ErreurLimite from '../components/ErreurLimite';
import BoutonInstaller from '../components/BoutonInstaller';
import { prechargerDonnees } from '../services/api';

export default function LayoutPrincipal() {
  const { utilisateur, deconnexion, estAdmin } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const location = useLocation();
  const [versionPage, setVersionPage] = useState(0);

  // Au démarrage : on charge les données principales en arrière-plan
  useEffect(() => { prechargerDonnees(); }, []);

  // Données rafraîchies en silence : on remet à jour uniquement les pages de consultation (jamais un formulaire en cours)
  useEffect(() => {
    const pagesLectureSeule = ['/tableau-de-bord', '/statistiques', '/comptabilite', '/rapport'];
    const surMaj = () => { if (pagesLectureSeule.includes(window.location.pathname)) setVersionPage((v) => v + 1); };
    window.addEventListener('kl-donnees-maj', surMaj);
    return () => window.removeEventListener('kl-donnees-maj', surMaj);
  }, []);
  const navigate = useNavigate();
  const seDeconnecter = () => { deconnexion(); navigate('/connexion', { replace: true }); };
  const fermerMenu = () => setMenuOuvert(false);

  const lien = ({ isActive }) =>
    `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
      isActive
        ? 'bg-white/15 text-white shadow-sm'
        : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
    }`;

  const Section = ({ titre, children }) => (
    <div className="mb-5">
      <p className="px-3.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-200/40">{titre}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  const Lien = ({ to, icone, children }) => (
    <NavLink to={to} className={lien} onClick={fermerMenu}>
      <span className="text-base opacity-90">{icone}</span> {children}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen bg-charbon-950">
      {menuOuvert && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={fermerMenu} />}

      {/* Barre latérale bleu marine : cachée sur mobile (bouton ☰), toujours visible dès md */}
      <aside
        className={`fixed md:sticky md:top-0 md:h-screen inset-y-0 left-0 z-50 w-64 shrink-0 bg-gradient-to-b from-marine-800 to-marine-900 flex flex-col transition-transform duration-200
        ${menuOuvert ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Koloun Luxure" className="w-11 h-11 object-cover rounded-full ring-2 ring-white/20" />
            <div className="leading-tight">
              <p className="text-white font-bold text-sm">Koloun Luxure</p>
              <p className="text-[11px] text-blue-200/60">Gestion commerciale</p>
            </div>
          </div>
          <button onClick={fermerMenu} className="md:hidden text-blue-100/70"><FiX size={22} /></button>
        </div>

        <nav className="flex-1 px-3 pt-2 overflow-y-auto">
          <Section titre="Boutique">
            <Lien to="/tableau-de-bord" icone={<FiGrid />}>Tableau de bord</Lien>
            <Lien to="/ventes" icone={<FiShoppingCart />}>Ventes</Lien>
            <Lien to="/produits" icone={<FiBox />}>Produits</Lien>
            <Lien to="/commandes-speciales" icone={<FiStar />}>Commandes spéciales</Lien>
            <Lien to="/clients" icone={<FiUser />}>Clients</Lien>
          </Section>

          {estAdmin && (
            <Section titre="Finances">
              <Lien to="/dettes" icone={<FiCreditCard />}>Dettes clients</Lien>
              <Lien to="/depenses" icone={<FiTrendingDown />}>Dépenses</Lien>
              <Lien to="/comptabilite" icone={<FiDollarSign />}>Comptabilité</Lien>
              <Lien to="/cloture" icone={<FiLock />}>Clôture de caisse</Lien>
              <Lien to="/rapport" icone={<FiFileText />}>Rapport mensuel</Lien>
            </Section>
          )}

          {estAdmin && (
            <Section titre="Gestion">
              <Lien to="/commandes" icone={<FiTruck />}>Commandes fournisseurs</Lien>
              <Lien to="/statistiques" icone={<FiBarChart2 />}>Statistiques</Lien>
              <Lien to="/utilisateurs" icone={<FiUsers />}>Utilisateurs</Lien>
              <Lien to="/sauvegarde" icone={<FiDatabase />}>Sauvegarde</Lien>
            </Section>
          )}

          <Section titre="Suivi">
            <Lien to="/notifications" icone={<FiBell />}>Notifications</Lien>
          </Section>
        </nav>

        <BoutonInstaller className="px-3" />

        <div className="p-4 m-3 rounded-2xl bg-white/10">
          <p className="text-sm text-white font-semibold truncate">{utilisateur?.nom} {utilisateur?.prenom}</p>
          <p className="text-xs text-blue-200/60 mb-3 capitalize truncate">{utilisateur?.role} · {utilisateur?.boutique}</p>
          <button onClick={seDeconnecter} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-xl py-2 transition">
            <FiLogOut /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre du haut sur mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-marine-800 sticky top-0 z-30 shadow-md">
          <button onClick={() => setMenuOuvert(true)} className="text-white p-1"><FiMenu size={22} /></button>
          <span className="text-white font-semibold text-sm">Koloun Luxure</span>
          <img src={logo} alt="" className="w-8 h-8 object-cover rounded-full ring-2 ring-white/20" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
              <ErreurLimite cle={location.pathname}><React.Fragment key={versionPage}><Outlet /></React.Fragment></ErreurLimite>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
