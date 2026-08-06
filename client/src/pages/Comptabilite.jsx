import React, { useEffect, useState } from 'react';
import { FiDollarSign } from 'react-icons/fi';
import { comptabilite } from '../services/statistiqueService';

export default function Comptabilite() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [donnees, setDonnees] = useState(null);

  useEffect(() => {
    comptabilite(date).then(setDonnees).catch(() => {});
  }, [date]);

  const formaterGNF = (val) => `${Number(val || 0).toLocaleString('fr-FR')} GNF`;

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="titre-or text-2xl flex items-center gap-2"><FiDollarSign /> Comptabilité</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-champ w-auto" />
      </div>

      {/* Totaux généraux par moyen de paiement */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {donnees && Object.entries(donnees.total_par_moyen_paiement).map(([moyen, montant]) => (
          <div key={moyen} className="card">
            <p className="text-xs text-charbon-100/60">{moyen}</p>
            <p className="text-xl font-semibold text-or-300">{formaterGNF(montant)}</p>
          </div>
        ))}
        <div className="card">
          <p className="text-xs text-charbon-100/60">Total de la journée</p>
          <p className="text-xl font-semibold text-or-300">{formaterGNF(donnees?.total_general)}</p>
        </div>
      </div>

      {/* Détail par article */}
      <div className="card overflow-x-auto">
        <h2 className="text-or-300 font-medium mb-4">Détail par article — {new Date(date).toLocaleDateString('fr-FR')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-charbon-100/60 border-b border-charbon-800">
              <th className="pb-2">Article</th>
              <th className="pb-2">Orange Money</th>
              <th className="pb-2">Paiement Marchand</th>
              <th className="pb-2">Cash</th>
              <th className="pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.articles.map((a) => (
              <tr key={a.produit} className="border-b border-charbon-800/50">
                <td className="py-2">{a.produit}</td>
                <td className="py-2">{a['Orange Money'] ? formaterGNF(a['Orange Money']) : '—'}</td>
                <td className="py-2">{a['Paiement Marchand'] ? formaterGNF(a['Paiement Marchand']) : '—'}</td>
                <td className="py-2">{a['Cash'] ? formaterGNF(a['Cash']) : '—'}</td>
                <td className="py-2 text-or-300 font-medium">{formaterGNF(a.total)}</td>
              </tr>
            ))}
            {(!donnees || donnees.articles.length === 0) && (
              <tr><td colSpan={5} className="text-center py-6 text-charbon-100/40">Aucune vente ce jour-là.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
