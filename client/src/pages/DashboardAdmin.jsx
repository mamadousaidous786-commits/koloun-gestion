import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FiDollarSign, FiShoppingBag, FiAlertTriangle, FiTrendingDown, FiBell } from 'react-icons/fi';
import { dashboardAdmin } from '../services/statistiqueService';

ChartJS.register(ArcElement, Tooltip, Legend);

function CarteStat({ icone, titre, valeur, couleur }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${couleur}`}>
        {icone}
      </div>
      <div>
        <p className="text-xs text-charbon-100/60">{titre}</p>
        <p className="text-xl font-semibold text-or-200">{valeur}</p>
      </div>
    </div>
  );
}

export default function DashboardAdmin() {
  const [donnees, setDonnees] = useState(null);

  useEffect(() => {
    dashboardAdmin().then(setDonnees).catch(() => {});
  }, []);

  const formaterGNF = (val) => `${Number(val || 0).toLocaleString('fr-FR')} GNF`;

  const donneesGraphique = donnees ? {
    labels: donnees.ventes_par_moyen_paiement.map((v) => v.MoyenPaiement.nom),
    datasets: [{
      data: donnees.ventes_par_moyen_paiement.map((v) => v.total),
      backgroundColor: ['#2563eb', '#1d4ed8', '#1e3a8a'],
      borderColor: '#ffffff',
    }],
  } : null;

  return (
    <div>
      <h1 className="titre-or text-2xl mb-6">Tableau de bord — Administrateur</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <CarteStat icone={<FiDollarSign />} titre="Chiffre d'affaires du jour" valeur={formaterGNF(donnees?.chiffre_affaires_jour)} couleur="bg-or-500/20 text-or-300" />
        <CarteStat icone={<FiDollarSign />} titre="Chiffre d'affaires du mois" valeur={formaterGNF(donnees?.chiffre_affaires_mois)} couleur="bg-or-500/20 text-or-300" />
        <CarteStat icone={<FiShoppingBag />} titre="Ventes aujourd'hui" valeur={donnees?.nombre_ventes_jour ?? '—'} couleur="bg-blue-500/20 text-blue-300" />
        <CarteStat icone={<FiBell />} titre="Notifications non lues" valeur={donnees?.notifications_non_lues ?? '—'} couleur="bg-purple-500/20 text-purple-300" />
        <CarteStat icone={<FiAlertTriangle />} titre="Produits en rupture" valeur={donnees?.produits_en_rupture ?? '—'} couleur="bg-red-500/20 text-red-300" />
        <CarteStat icone={<FiTrendingDown />} titre="Produits en stock faible" valeur={donnees?.produits_stock_faible ?? '—'} couleur="bg-yellow-500/20 text-yellow-300" />
      </div>

      <div className="card max-w-md">
        <h2 className="text-or-300 font-medium mb-4">Répartition des ventes par moyen de paiement (mois)</h2>
        {donneesGraphique && donneesGraphique.labels.length > 0 ? (
          <Doughnut data={donneesGraphique} />
        ) : (
          <p className="text-charbon-100/50 text-sm">Aucune donnée pour le moment.</p>
        )}
      </div>
    </div>
  );
}
