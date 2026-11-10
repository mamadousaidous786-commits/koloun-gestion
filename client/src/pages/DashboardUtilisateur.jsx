import React, { useEffect, useState } from 'react';
import { FiDollarSign, FiShoppingBag, FiBox, FiAlertTriangle, FiGrid } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Stat from '../components/Stat';
import { dashboardUtilisateur } from '../services/statistiqueService';
import { formaterGNF } from '../utils/format';

export default function DashboardUtilisateur() {
  const [d, setD] = useState(null);

  useEffect(() => {
    dashboardUtilisateur().then(setD).catch(() => {});
  }, []);

  return (
    <div>
      <EnTete titre="Mon tableau de bord" sousTitre="Votre activité du jour" icone={<FiGrid />} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat icone={<FiDollarSign />} titre="Mes ventes du jour" valeur={formaterGNF(d?.ventes_jour)} teinte="bleu" />
        <Stat icone={<FiShoppingBag />} titre="Mes ventes du mois" valeur={formaterGNF(d?.ventes_mois)} teinte="vert" />
        <Stat icone={<FiBox />} titre="Articles disponibles" valeur={d?.produits_disponibles ?? '—'} teinte="violet" />
        <Stat icone={<FiAlertTriangle />} titre="En rupture" valeur={d?.produits_en_rupture ?? '—'} teinte="rouge" />
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-3">Mes dernières ventes</h2>
        <div className="divide-y divide-slate-100">
          {d?.dernieres_ventes?.length > 0 ? d.dernieres_ventes.map((v) => (
            <div key={v.id} className="flex justify-between text-sm py-2.5">
              <span className="text-slate-600">{v.numero_recu}</span>
              <span className="font-semibold text-slate-900">{formaterGNF(v.montant_total)}</span>
            </div>
          )) : <p className="text-slate-400 text-sm">Aucune vente récente.</p>}
        </div>
      </div>
    </div>
  );
}
