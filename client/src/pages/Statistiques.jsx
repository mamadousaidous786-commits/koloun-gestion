import React, { useEffect, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { produitsPlusVendus, rechercheIntelligente } from '../services/statistiqueService';

export default function Statistiques() {
  const [topProduits, setTopProduits] = useState([]);
  const [terme, setTerme] = useState('');
  const [resultatRecherche, setResultatRecherche] = useState(null);

  useEffect(() => { produitsPlusVendus().then(setTopProduits).catch(() => {}); }, []);

  const rechercher = async (e) => {
    e.preventDefault();
    if (!terme.trim()) return;
    const res = await rechercheIntelligente(terme);
    setResultatRecherche(res);
  };

  return (
    <div>
      <h1 className="titre-or text-2xl mb-6">Statistiques avancées</h1>

      <div className="card mb-6">
        <h2 className="text-or-300 font-medium mb-4">Recherche intelligente</h2>
        <form onSubmit={rechercher} className="flex gap-2 mb-4 max-w-md">
          <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Ex: Lacoste, un vendeur, une catégorie..." className="input-champ flex-1" />
          <button className="btn-primary"><FiSearch /></button>
        </form>
        {resultatRecherche && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-charbon-100/60">Quantité vendue</p><p className="text-or-300 font-semibold">{resultatRecherche.nombre_vendu}</p></div>
            <div><p className="text-charbon-100/60">Chiffre d'affaires</p><p className="text-or-300 font-semibold">{Number(resultatRecherche.chiffre_affaires).toLocaleString('fr-FR')} GNF</p></div>
            {Object.entries(resultatRecherche.repartition_paiement).map(([moyen, montant]) => (
              <div key={moyen}><p className="text-charbon-100/60">{moyen}</p><p className="text-or-300 font-semibold">{Number(montant).toLocaleString('fr-FR')} GNF</p></div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-or-300 font-medium mb-4">Produits les plus vendus</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-charbon-100/60 border-b border-charbon-800"><th className="pb-2">Produit</th><th className="pb-2">Quantité vendue</th><th className="pb-2">Chiffre d'affaires</th></tr></thead>
          <tbody>
            {topProduits.map((p) => (
              <tr key={p.ProduitTaille?.ProduitVariante?.produit_id} className="border-b border-charbon-800/50">
                <td className="py-2">{p.ProduitTaille?.ProduitVariante?.Produit?.nom}</td>
                <td className="py-2">{p.quantite_vendue}</td>
                <td className="py-2 text-or-300">{Number(p.chiffre_affaires).toLocaleString('fr-FR')} GNF</td>
              </tr>
            ))}
            {topProduits.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-charbon-100/40">Aucune donnée.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
