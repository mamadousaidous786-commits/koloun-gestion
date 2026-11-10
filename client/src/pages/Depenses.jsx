import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiTrendingDown, FiTrash2 } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import Stat from '../components/Stat';
import { listerDepenses, creerDepense, supprimerDepense } from '../services/depenseService';
import { formaterGNF, formaterDate, aujourdhui, moisCourant } from '../utils/format';

const CATEGORIES = ['Loyer', 'Transport', 'Électricité / Eau', 'Salaires', 'Marketing', 'Emballage', 'Réparations', 'Autre'];
const vide = () => ({ categorie: 'Transport', description: '', montant: '', date_depense: aujourdhui() });

export default function Depenses() {
  const [mois, setMois] = useState(moisCourant());
  const [categorie, setCategorie] = useState('');
  const [donnees, setDonnees] = useState({ depenses: [], total: 0, par_categorie: {} });
  const [modal, setModal] = useState(false);
  const [formulaire, setFormulaire] = useState(vide());

  const charger = () =>
    listerDepenses({ mois, categorie: categorie || undefined }).then(setDonnees).catch(() => toast.error('Impossible de charger les dépenses.'));

  useEffect(() => { charger(); }, [mois, categorie]);

  const soumettre = async (e) => {
    e.preventDefault();
    try {
      await creerDepense(formulaire);
      toast.success('Dépense enregistrée.');
      setModal(false);
      setFormulaire(vide());
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const supprimer = async (d) => {
    if (!confirm(`Supprimer cette dépense de ${formaterGNF(d.montant)} ?`)) return;
    await supprimerDepense(d.id);
    charger();
  };

  const parCategorie = Object.entries(donnees.par_categorie).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <EnTete titre="Dépenses" sousTitre="Loyer, transport, électricité… pour connaître votre vrai bénéfice" icone={<FiTrendingDown />}>
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className="input-champ !w-auto" />
        <button onClick={() => setModal(true)} className="btn-primary"><FiPlus /> Nouvelle dépense</button>
      </EnTete>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Stat icone={<FiTrendingDown />} titre="Total du mois" valeur={formaterGNF(donnees.total)} teinte="rouge" />
        <div className="card lg:col-span-2">
          <p className="text-xs text-slate-500 mb-3">Répartition par catégorie</p>
          {parCategorie.length === 0 ? <p className="text-sm text-slate-400">Aucune dépense ce mois-ci.</p> : (
            <div className="space-y-2">
              {parCategorie.map(([nom, montant]) => (
                <div key={nom}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{nom}</span><span className="font-medium">{formaterGNF(montant)}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(montant / donnees.total) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="font-semibold text-slate-900">Détail</h2>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="input-champ !w-auto !py-2 text-xs">
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-2">Date</th><th className="pb-2">Catégorie</th><th className="pb-2">Description</th><th className="pb-2 text-right">Montant</th><th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {donnees.depenses.map((d) => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="py-2.5 whitespace-nowrap">{formaterDate(d.date_depense)}</td>
                <td className="py-2.5"><span className="badge bg-slate-50 text-slate-700 ring-slate-200">{d.categorie}</span></td>
                <td className="py-2.5 text-slate-600">{d.description || '—'}</td>
                <td className="py-2.5 text-right font-semibold whitespace-nowrap">{formaterGNF(d.montant)}</td>
                <td className="py-2.5 text-right"><button onClick={() => supprimer(d)} className="text-slate-300 hover:text-red-600"><FiTrash2 size={15} /></button></td>
              </tr>
            ))}
            {donnees.depenses.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Aucune dépense.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titre="Nouvelle dépense" onClose={() => setModal(false)}>
          <form onSubmit={soumettre} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="etiquette">Catégorie</label>
                <select className="input-champ" value={formulaire.categorie} onChange={(e) => setFormulaire({ ...formulaire, categorie: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="etiquette">Date</label>
                <input required type="date" className="input-champ" value={formulaire.date_depense} onChange={(e) => setFormulaire({ ...formulaire, date_depense: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="etiquette">Montant (GNF)</label>
              <input required type="number" min="1" className="input-champ" value={formulaire.montant} onChange={(e) => setFormulaire({ ...formulaire, montant: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Description (facultatif)</label>
              <input className="input-champ" placeholder="Ex : taxi pour récupérer la marchandise" value={formulaire.description} onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
