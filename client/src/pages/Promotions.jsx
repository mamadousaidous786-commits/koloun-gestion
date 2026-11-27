import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPercent, FiPlus, FiSearch, FiStopCircle, FiClock } from 'react-icons/fi';
import api from '../services/api';
import Modal from '../components/Modal';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF } from '../utils/format';

// Promotions : prix barré et « -30 % » dans Koloun Boutique, prix promo proposé à la caisse.
// Les articles sont ceux choisis à la création : ceux ajoutés ensuite restent au prix normal.
const ETATS = {
  en_cours: { libelle: 'En cours', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  a_venir: { libelle: 'À venir', classe: 'bg-blue-50 text-blue-700 ring-blue-200' },
  terminee: { libelle: 'Terminée', classe: 'bg-slate-100 text-slate-600 ring-slate-200' },
  arretee: { libelle: 'Arrêtée', classe: 'bg-slate-100 text-slate-600 ring-slate-200' },
};
const arrondi = (x) => Math.round(x / 500) * 500;
const pourInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const lisible = (d) => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function dimancheSoir() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); d.setHours(23, 59, 0, 0); return d; }

export default function Promotions() {
  const [liste, setListe] = useState(null);
  const [creation, setCreation] = useState(false);
  const [prolonger, setProlonger] = useState(null);
  const charger = () => api.get('/promotions').then((r) => setListe(r.data)).catch(() => setListe([]));
  useEffect(() => { charger(); }, []);

  const arreter = async (p) => {
    if (!window.confirm(`Arrêter « ${p.nom} » maintenant ? Les prix reviennent au prix normal tout de suite.`)) return;
    try { await api.put(`/promotions/${p.id}`, { actif: false }); toast.success('Promotion arrêtée : prix normaux rétablis.'); charger(); } catch (e) { toast.error(e.response?.data?.message || 'Erreur.'); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FiPercent /> Promotions</h1>
          <p className="text-sm text-slate-500">Prix barré dans Koloun Boutique, prix promo à la caisse. Retour au prix normal automatique à la fin.</p>
        </div>
        <button onClick={() => setCreation(true)} className="btn-primary"><FiPlus /> Nouvelle promotion</button>
      </div>

      {liste === null ? <p className="text-slate-400">Chargement…</p> : !liste.length ? (
        <div className="card text-center py-10">
          <p className="text-slate-600">Aucune promotion pour le moment.</p>
          <button onClick={() => setCreation(true)} className="btn-primary mt-4 mx-auto"><FiPlus /> Créer le Black Friday</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-extrabold text-red-600 leading-none">-{p.pourcentage}%</p>
                  <p className="font-semibold text-slate-900 mt-1">{p.nom}</p>
                </div>
                <span className={`badge ${ETATS[p.etat].classe}`}>{ETATS[p.etat].libelle}</span>
              </div>
              <div className="text-sm text-slate-600 mt-3 space-y-0.5">
                <p>Du {lisible(p.debut)}</p>
                <p>au <b>{lisible(p.fin)}</b></p>
                <p>{p.nb_articles} article{p.nb_articles > 1 ? 's' : ''}</p>
              </div>
              {['en_cours', 'a_venir'].includes(p.etat) && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setProlonger({ ...p, nouvelleFin: pourInput(p.fin) })} className="btn-secondary flex-1"><FiClock /> Changer la fin</button>
                  <button onClick={() => arreter(p)} className="btn-secondary text-red-600"><FiStopCircle /> Arrêter</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creation && <NouvellePromotion onClose={() => setCreation(false)} onFait={() => { setCreation(false); charger(); }} />}

      {prolonger && (
        <Modal titre={`Fin de « ${prolonger.nom} »`} onClose={() => setProlonger(null)}>
          <div className="space-y-4">
            <div><label className="etiquette">Nouvelle date et heure de fin</label>
              <input type="datetime-local" className="input-champ" value={prolonger.nouvelleFin} onChange={(e) => setProlonger({ ...prolonger, nouvelleFin: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setProlonger(null)} className="btn-secondary">Annuler</button>
              <button onClick={async () => {
                try { await api.put(`/promotions/${prolonger.id}`, { fin: prolonger.nouvelleFin }); toast.success('Date de fin mise à jour.'); setProlonger(null); charger(); } catch (e) { toast.error(e.response?.data?.message || 'Erreur.'); }
              }} className="btn-primary">Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NouvellePromotion({ onClose, onFait }) {
  const [nom, setNom] = useState('Black Friday');
  const [pourcentage, setPourcentage] = useState('30');
  const [debut, setDebut] = useState(pourInput(new Date()));
  const [fin, setFin] = useState(pourInput(dimancheSoir()));
  const [tous, setTous] = useState(true);
  const [produits, setProduits] = useState([]);
  const [choix, setChoix] = useState(new Set());
  const [recherche, setRecherche] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { api.get('/promotions/produits').then((r) => setProduits(r.data)).catch(() => {}); }, []);
  const visibles = useMemo(() => produits.filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase())), [produits, recherche]);
  const exemple = produits[0];
  const pc = Number(pourcentage) || 0;

  const creer = async () => {
    if (!(pc > 0 && pc < 100)) return toast.error('Pourcentage entre 1 et 99.');
    if (!tous && !choix.size) return toast.error('Choisissez au moins un article.');
    setEnvoi(true);
    try {
      const r = await api.post('/promotions', { nom, pourcentage: pc, debut, fin, produits: tous ? undefined : [...choix] });
      toast.success(`Promotion créée sur ${r.data.nb_articles} articles.`);
      onFait();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur.'); }
    setEnvoi(false);
  };

  return (
    <Modal titre="Nouvelle promotion" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className="etiquette">Nom (affiché aux clients)</label><input className="input-champ" value={nom} onChange={(e) => setNom(e.target.value)} /></div>
          <div><label className="etiquette">Réduction %</label><input type="number" min="1" max="99" inputMode="numeric" className="input-champ" value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="etiquette">Début</label><input type="datetime-local" className="input-champ" value={debut} onChange={(e) => setDebut(e.target.value)} /></div>
          <div><label className="etiquette">Fin</label><input type="datetime-local" className="input-champ" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={tous} onChange={() => setTous(true)} /> Tous les articles actuels ({produits.length})</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!tous} onChange={() => setTous(false)} /> Choisir les articles</label>
          <p className="text-xs text-slate-500">Les articles que vous ajouterez pendant la promotion resteront au prix normal.</p>
        </div>

        {!tous && (
          <div className="border border-slate-200 rounded-xl">
            <div className="relative p-2 border-b border-slate-100">
              <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input-champ !pl-9" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            </div>
            <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {visibles.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={choix.has(p.id)} onChange={() => { const n = new Set(choix); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setChoix(n); }} />
                    {p.image ? <img src={urlFichier(p.image)} alt="" className="w-9 h-9 rounded-md object-cover" /> : <span className="w-9 h-9 rounded-md bg-slate-100" />}
                    <span className="flex-1 min-w-0 text-sm truncate">{p.nom}</span>
                    <span className="text-xs text-slate-500">{formaterGNF(p.prix_normal)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100">{choix.size} choisi{choix.size > 1 ? 's' : ''}</p>
          </div>
        )}

        {exemple && pc > 0 && pc < 100 && (
          <div className="bg-red-50 rounded-xl px-4 py-3 text-sm">
            Exemple : <b>{exemple.nom}</b> passe de <span className="line-through text-slate-500">{formaterGNF(exemple.prix_normal)}</span> à <b className="text-red-600">{formaterGNF(arrondi((exemple.prix_normal * (100 - pc)) / 100))}</b> (arrondi à 500 GNF).
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={creer} disabled={envoi} className="btn-primary !bg-none !bg-red-600 hover:!bg-red-700">{envoi ? 'Création…' : `Lancer -${pc || '…'} %`}</button>
        </div>
      </div>
    </Modal>
  );
}
