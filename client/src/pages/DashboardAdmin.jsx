import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  FiDollarSign, FiShoppingBag, FiAlertTriangle, FiTrendingDown, FiBell, FiStar, FiCreditCard, FiGrid,
} from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Stat from '../components/Stat';
import { dashboardAdmin } from '../services/statistiqueService';
import { formaterGNF } from '../utils/format';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DashboardAdmin() {
  const [d, setD] = useState(null);

  useEffect(() => {
    dashboardAdmin().then(setD).catch(() => {});
  }, []);

  const graphique = d && d.ventes_par_moyen_paiement.length > 0 ? {
    labels: d.ventes_par_moyen_paiement.map((v) => v.MoyenPaiement.nom),
    datasets: [{
      data: d.ventes_par_moyen_paiement.map((v) => v.total),
      backgroundColor: ['#2563eb', '#60a5fa', '#1e3a8a'],
      borderColor: '#ffffff',
      borderWidth: 3,
    }],
  } : null;

  return (
    <div>
      <EnTete titre="Tableau de bord" sousTitre="Vue d'ensemble de votre boutique" icone={<FiGrid />} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Stat icone={<FiDollarSign />} titre="Chiffre d'affaires du jour" valeur={formaterGNF(d?.chiffre_affaires_jour)} teinte="bleu" />
        <Stat icone={<FiDollarSign />} titre="Chiffre d'affaires du mois" valeur={formaterGNF(d?.chiffre_affaires_mois)} teinte="bleu" />
        <Stat icone={<FiShoppingBag />} titre="Ventes aujourd'hui" valeur={d?.nombre_ventes_jour ?? '—'} teinte="vert" />
        <Stat icone={<FiTrendingDown />} titre="Dépenses du mois" valeur={formaterGNF(d?.depenses_mois)} teinte="gris" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Link to="/dettes" className="block hover:-translate-y-0.5 transition">
          <Stat icone={<FiCreditCard />} titre="Dettes à récupérer" valeur={formaterGNF(d?.dettes_total_restant)}
            detail={d ? `${d.dettes_nombre} personne(s)${d.dettes_en_retard ? ` · ${d.dettes_en_retard} en retard` : ''}` : ''}
            teinte={d?.dettes_en_retard ? 'orange' : 'rouge'} />
        </Link>
        <Link to="/commandes-speciales" className="block hover:-translate-y-0.5 transition">
          <Stat icone={<FiStar />} titre="Commandes spéciales en cours" valeur={d?.commandes_speciales_en_cours ?? '—'}
            detail={d?.commandes_speciales_arrivees ? `${d.commandes_speciales_arrivees} arrivée(s) à remettre` : ''} teinte="violet" />
        </Link>
        <Link to="/produits" className="block hover:-translate-y-0.5 transition">
          <Stat icone={<FiAlertTriangle />} titre="Ruptures / stock faible" valeur={d ? `${d.produits_en_rupture} / ${d.produits_stock_faible}` : '—'} teinte={d?.produits_en_rupture ? 'rouge' : 'orange'} />
        </Link>
        <Link to="/notifications" className="block hover:-translate-y-0.5 transition">
          <Stat icone={<FiBell />} titre="Notifications non lues" valeur={d?.notifications_non_lues ?? '—'} teinte="violet" />
        </Link>
      </div>

      <div className="card max-w-md">
        <h2 className="font-semibold text-slate-900 mb-4">Ventes du mois par moyen de paiement</h2>
        {graphique ? <Doughnut data={graphique} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '65%' }} /> : (
          <p className="text-slate-400 text-sm">Aucune vente ce mois-ci.</p>
        )}
      </div>
    </div>
  );
}
