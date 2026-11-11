import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiLock, FiCheckCircle, FiAlertTriangle, FiTrash2, FiEdit2 } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import { apercuCloture, enregistrerCloture, listerClotures, supprimerCloture } from '../services/clotureService';
import { formaterGNF, formaterDate, aujourdhui } from '../utils/format';

const LIGNES = [
  { cle: 'cash', libelle: 'Espèces (Cash)', champ: 'compte_cash', obligatoire: true },
  { cle: 'om', libelle: 'Orange Money', champ: 'compte_om' },
  { cle: 'pm', libelle: 'Paiement Marchand', champ: 'compte_pm' },
];

function Ecart({ valeur }) {
  if (valeur === null || valeur === undefined || valeur === '') return <span className="text-slate-300">—</span>;
  const n = Number(valeur);
  if (n === 0) return <span className="text-emerald-600 font-semibold inline-flex items-center gap-1"><FiCheckCircle size={13} /> Aucun écart</span>;
  return <span className={`font-semibold inline-flex items-center gap-1 ${n < 0 ? 'text-red-600' : 'text-amber-600'}`}><FiAlertTriangle size={13} /> {n > 0 ? '+' : ''}{formaterGNF(n)}</span>;
}

export default function Cloture() {
  const [date, setDate] = useState(aujourdhui());
  const [apercu, setApercu] = useState(null);
  const [comptes, setComptes] = useState({ compte_cash: '', compte_om: '', compte_pm: '' });
  const [note, setNote] = useState('');
  const [historique, setHistorique] = useState([]);

  const chargerHistorique = () => listerClotures().then(setHistorique).catch(() => {});

  useEffect(() => {
    apercuCloture(date).then((a) => {
      setApercu(a);
      const c = a.cloture_existante;
      setComptes({
        compte_cash: c?.compte_cash ?? '', compte_om: c?.compte_om ?? '', compte_pm: c?.compte_pm ?? '',
      });
      setNote(c?.note || '');
    }).catch(() => toast.error("Impossible de calculer l'aperçu."));
  }, [date]);

  useEffect(() => { chargerHistorique(); }, []);

  const ecartEnDirect = (cle, champ) => {
    if (comptes[champ] === '' || !apercu) return null;
    return Number(comptes[champ]) - apercu.attendu[cle];
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await enregistrerCloture({ date, ...comptes, note });
      toast.success(`Caisse du ${formaterDate(date)} clôturée.`);
      chargerHistorique();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const supprimer = async (id, jour) => {
    if (!confirm(`Supprimer la clôture du ${formaterDate(jour)} ? Vous pourrez la refaire.`)) return;
    try {
      await supprimerCloture(id);
      toast.success('Clôture supprimée.');
      chargerHistorique();
      if (String(jour).slice(0, 10) === date) {
        setComptes({ compte_cash: '', compte_om: '', compte_pm: '' });
        setNote('');
        apercuCloture(date).then(setApercu).catch(() => {});
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  return (
    <div>
      <EnTete titre="Clôture de caisse" sousTitre="Comparez ce que les ventes annoncent avec l'argent réellement compté" icone={<FiLock />}>
        <input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} className="input-champ !w-auto" />
      </EnTete>

      {apercu && (
        <form onSubmit={enregistrer} className="card mb-6">
          <div className="flex flex-wrap justify-between gap-2 mb-4">
            <p className="text-sm text-slate-600"><strong>{apercu.nombre_ventes}</strong> vente(s) le {formaterDate(date)} · total <strong>{formaterGNF(apercu.total)}</strong></p>
            {apercu.cloture_existante && <span className="badge bg-blue-50 text-blue-700 ring-blue-200">Déjà clôturée — vous pouvez corriger</span>}
          </div>

          <div className="space-y-3">
            {LIGNES.map((l) => (
              <div key={l.cle} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1.2fr] gap-2 sm:gap-4 items-center bg-slate-50 rounded-xl p-3">
                <p className="font-medium text-slate-800">{l.libelle}</p>
                <div><p className="text-[11px] text-slate-500">Attendu (ventes)</p><p className="font-semibold">{formaterGNF(apercu.attendu[l.cle])}</p></div>
                <div>
                  <p className="text-[11px] text-slate-500">Compté{l.obligatoire ? '' : ' (facultatif)'}</p>
                  <input type="number" min="0" required={l.obligatoire} className="input-champ !py-1.5" value={comptes[l.champ]}
                    onChange={(e) => setComptes({ ...comptes, [l.champ]: e.target.value })} />
                </div>
                <div className="text-sm"><p className="text-[11px] text-slate-500">Écart</p><Ecart valeur={ecartEnDirect(l.cle, l.champ)} /></div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-3">Dépenses enregistrées ce jour : <strong>{formaterGNF(apercu.depenses_jour)}</strong> (à garder en tête si vous avez payé en espèces depuis la caisse).</p>

          <div className="mt-4">
            <label className="etiquette">Note (facultatif)</label>
            <input className="input-champ" placeholder="Ex : 5 000 GNF donnés en monnaie au client" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            {apercu.cloture_existante && (
              <button type="button" onClick={() => supprimer(apercu.cloture_existante.id, date)} className="btn-danger"><FiTrash2 /> Supprimer la clôture</button>
            )}
            <button type="submit" className="btn-primary"><FiLock /> {apercu.cloture_existante ? 'Enregistrer les modifications' : 'Clôturer la caisse'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-slate-900 mb-3">Historique des clôtures</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-2">Date</th><th className="pb-2">Cash attendu</th><th className="pb-2">Cash compté</th><th className="pb-2">Écart cash</th><th className="pb-2">Par</th><th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {historique.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 cursor-pointer" onClick={() => setDate(String(c.date_cloture).slice(0, 10))}>
                <td className="py-2.5 whitespace-nowrap">{formaterDate(c.date_cloture)}</td>
                <td className="py-2.5">{formaterGNF(c.attendu_cash)}</td>
                <td className="py-2.5">{formaterGNF(c.compte_cash)}</td>
                <td className="py-2.5"><Ecart valeur={c.ecart_cash} /></td>
                <td className="py-2.5 text-slate-500">{c.Utilisateur?.nom}</td>
                <td className="py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setDate(String(c.date_cloture).slice(0, 10)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-blue-700" title="Modifier"><FiEdit2 size={14} /></button>
                  <button onClick={() => supprimer(c.id, c.date_cloture)} className="p-2 text-slate-400 hover:text-red-600" title="Supprimer"><FiTrash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {historique.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Aucune clôture enregistrée.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
