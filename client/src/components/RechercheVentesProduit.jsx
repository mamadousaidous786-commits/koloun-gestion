import React, { useEffect, useState } from 'react';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { rechercheProduitVendu } from '../services/venteService';
import { formaterGNF, aujourdhui } from '../utils/format';

const ilYa = (jours) => new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);

// Administrateur : « Qui a vendu ce produit ? » (par vendeur, avec le détail de chaque vente)
export default function RechercheVentesProduit() {
  const [q, setQ] = useState('');
  const [du, setDu] = useState(ilYa(90));
  const [au, setAu] = useState(aujourdhui());
  const [res, setRes] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    setChargement(true);
    const t = setTimeout(() => {
      rechercheProduitVendu({ q: q.trim(), du, au }).then(setRes).catch(() => setRes(null)).finally(() => setChargement(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q, du, au]);

  return (
    <div className="card mt-6">
      <h2 className="font-semibold text-slate-900 flex items-center gap-2"><FiUsers /> Qui a vendu ce produit ?</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">Tapez le nom d'un produit : vous voyez quel vendeur l'a vendu, combien et quand.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" />
          <input className="input-champ pl-10" placeholder="Ex : chemise, robe, costume…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-1.5">du <input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} className="input-champ !w-auto" /></label>
        <label className="text-xs text-slate-500 flex items-center gap-1.5">au <input type="date" value={au} max={aujourdhui()} onChange={(e) => setAu(e.target.value)} className="input-champ !w-auto" /></label>
      </div>

      {chargement && <p className="text-sm text-slate-400">Recherche…</p>}

      {!chargement && res && res.lignes.length === 0 && <p className="text-sm text-slate-400">Aucune vente de « {q} » sur cette période.</p>}

      {!chargement && res && res.lignes.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {res.vendeurs.map((v) => (
              <div key={v.utilisateur_id} className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{v.vendeur}</p>
                <p className="text-sm text-slate-600"><b className="text-blue-700">{v.quantite}</b> pièce(s) · {formaterGNF(v.montant)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-2">Total : <b>{res.total_quantite}</b> pièce(s) · {formaterGNF(res.total_montant)}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2">Date</th><th className="pb-2">Vendeur</th><th className="pb-2">Produit</th>
                  <th className="pb-2">Taille</th><th className="pb-2">Qté</th><th className="pb-2">Total</th><th className="pb-2">Reçu</th>
                </tr>
              </thead>
              <tbody>
                {res.lignes.map((l, i) => (
                  <tr key={`${l.vente_id}-${i}`} className="border-b border-slate-50">
                    <td className="py-2 whitespace-nowrap">{new Date(l.date_vente).toLocaleString('fr-FR')}</td>
                    <td className="py-2 font-medium">{l.vendeur}</td>
                    <td className="py-2">{l.produit}</td>
                    <td className="py-2">{l.taille}</td>
                    <td className="py-2">{l.quantite}</td>
                    <td className="py-2 whitespace-nowrap">{formaterGNF(l.sous_total)}</td>
                    <td className="py-2 whitespace-nowrap text-slate-500">{l.numero_recu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
