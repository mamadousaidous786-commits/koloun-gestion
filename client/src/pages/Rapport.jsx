import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiFileText, FiPrinter } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import { rapportMensuel } from '../services/rapportService';
import { formaterGNF, moisCourant } from '../utils/format';

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function Ligne({ libelle, valeur, fort, couleur }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${fort ? 'font-bold border-t border-slate-200 mt-1 pt-3 text-base' : 'text-slate-700'}`}>
      <span>{libelle}</span>
      <span className={couleur || ''}>{valeur}</span>
    </div>
  );
}

export default function Rapport() {
  const [mois, setMois] = useState(moisCourant());
  const [r, setR] = useState(null);

  useEffect(() => {
    setR(null);
    rapportMensuel(mois).then(setR).catch(() => toast.error('Impossible de générer le rapport.'));
  }, [mois]);

  const [annee, numero] = mois.split('-');
  const titreMois = `${NOMS_MOIS[Number(numero) - 1]} ${annee}`;
  const jours = r ? Object.entries(r.ventes.par_jour).sort() : [];
  const maxJour = Math.max(1, ...jours.map(([, m]) => m));

  return (
    <div>
      <EnTete titre="Rapport mensuel" sousTitre="Ventes, dépenses, dettes et résultat du mois" icone={<FiFileText />}>
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className="input-champ !w-auto" />
        <button onClick={() => window.print()} className="btn-primary"><FiPrinter /> Imprimer / PDF</button>
      </EnTete>

      {!r ? <p className="text-slate-400 text-sm py-10 text-center">Calcul en cours…</p> : (
        <div className="space-y-4">
          <div className="card text-center">
            <p className="text-xs uppercase tracking-widest text-slate-400">Rapport d'activité</p>
            <h2 className="text-2xl font-bold text-slate-900 capitalize">{titreMois}</h2>
            <p className="text-sm text-slate-500">{r.boutique.nom}{r.boutique.adresse ? ` — ${r.boutique.adresse}` : ''}{r.boutique.telephone ? ` — ${r.boutique.telephone}` : ''}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">Encaissements</h3>
              <Ligne libelle={`Ventes (${r.ventes.nombre})`} valeur={formaterGNF(r.ventes.total)} />
              {Object.entries(r.ventes.par_moyen_paiement).map(([m, v]) => (
                <div key={m} className="flex justify-between text-xs text-slate-500 pl-4 py-0.5"><span>dont {m}</span><span>{formaterGNF(v)}</span></div>
              ))}
              <Ligne libelle="Commandes spéciales (avances et soldes)" valeur={formaterGNF(r.commandes_speciales.encaisse)} />
              <Ligne libelle="Dettes récupérées" valeur={formaterGNF(r.dettes.encaisse)} />
              <Ligne libelle="Total encaissé" valeur={formaterGNF(r.total_encaisse)} fort couleur="text-blue-700" />
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">Dépenses et résultat</h3>
              <Ligne libelle="Total encaissé" valeur={formaterGNF(r.total_encaisse)} />
              <Ligne libelle="Dépenses de la boutique" valeur={`− ${formaterGNF(r.depenses.total)}`} couleur="text-red-600" />
              {Object.entries(r.depenses.par_categorie).map(([c, v]) => (
                <div key={c} className="flex justify-between text-xs text-slate-500 pl-4 py-0.5"><span>{c}</span><span>{formaterGNF(v)}</span></div>
              ))}
              <Ligne libelle="Résultat avant achats de stock" valeur={formaterGNF(r.resultat_avant_achats)} fort couleur={r.resultat_avant_achats >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Ligne libelle="Achats fournisseurs du mois (marchandise + transport)" valeur={`− ${formaterGNF(r.achats_fournisseurs)}`} couleur="text-red-600" />
              <Ligne libelle="Résultat après achats de stock" valeur={formaterGNF(r.resultat_apres_achats)} fort couleur={r.resultat_apres_achats >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-3">Ventes par jour</h3>
              {jours.length === 0 ? <p className="text-sm text-slate-400">Aucune vente ce mois-ci.</p> : (
                <div className="flex items-end gap-1 h-32">
                  {jours.map(([jour, montant]) => (
                    <div key={jour} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${jour} : ${formaterGNF(montant)}`}>
                      <div className="w-full bg-blue-500 rounded-t group-hover:bg-blue-700 transition" style={{ height: `${Math.max(4, (montant / maxJour) * 100)}%` }} />
                      <span className="text-[9px] text-slate-400 mt-1">{jour.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">Produits les plus vendus</h3>
              {r.ventes.top_produits.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
                <table className="w-full text-sm">
                  <tbody>
                    {r.ventes.top_produits.map((p) => (
                      <tr key={p.produit} className="border-b border-slate-50">
                        <td className="py-1.5">{p.produit}</td>
                        <td className="py-1.5 text-right text-slate-500">{p.quantite} vendu(s)</td>
                        <td className="py-1.5 text-right font-medium">{formaterGNF(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-900 mb-2">À surveiller</h3>
            <Ligne libelle="Dettes clients encore à récupérer (au total)" valeur={formaterGNF(r.dettes.reste_global)} couleur="text-red-600" />
            <Ligne libelle="Commandes spéciales enregistrées ce mois" valeur={r.commandes_speciales.creees} />
          </div>
        </div>
      )}
    </div>
  );
}
