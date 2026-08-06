import React, { useEffect, useState } from 'react';
import { dashboardUtilisateur } from '../services/statistiqueService';

export default function DashboardUtilisateur() {
  const [donnees, setDonnees] = useState(null);

  useEffect(() => {
    dashboardUtilisateur().then(setDonnees).catch(() => {});
  }, []);

  const formaterGNF = (val) => `${Number(val || 0).toLocaleString('fr-FR')} GNF`;

  return (
    <div>
      <h1 className="titre-or text-2xl mb-6">Mon tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-xs text-charbon-100/60">Mes ventes du jour</p>
          <p className="text-xl font-semibold text-or-200">{formaterGNF(donnees?.ventes_jour)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-charbon-100/60">Mes ventes du mois</p>
          <p className="text-xl font-semibold text-or-200">{formaterGNF(donnees?.ventes_mois)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-charbon-100/60">Produits disponibles</p>
          <p className="text-xl font-semibold text-or-200">{donnees?.produits_disponibles ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-charbon-100/60">Produits en rupture</p>
          <p className="text-xl font-semibold text-red-300">{donnees?.produits_en_rupture ?? '—'}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-or-300 font-medium mb-4">Mes dernières ventes</h2>
        <div className="space-y-2">
          {donnees?.dernieres_ventes?.length > 0 ? donnees.dernieres_ventes.map((v) => (
            <div key={v.id} className="flex justify-between text-sm border-b border-charbon-800 py-2">
              <span className="text-charbon-100/80">{v.numero_recu}</span>
              <span className="text-or-300 font-medium">{formaterGNF(v.montant_total)}</span>
            </div>
          )) : <p className="text-charbon-100/50 text-sm">Aucune vente récente.</p>}
        </div>
      </div>
    </div>
  );
}
