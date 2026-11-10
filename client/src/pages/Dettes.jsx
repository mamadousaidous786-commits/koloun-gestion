import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiCreditCard, FiTrash2, FiUsers, FiAlertTriangle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import Stat from '../components/Stat';
import ChampClient from '../components/ChampClient';
import BoutonsContact from '../components/BoutonsContact';
import { listerDettes, creerDette, ajouterPaiementDette, supprimerPaiementDette, supprimerDette } from '../services/detteService';
import { listerClients } from '../services/clientService';
import { formaterGNF, formaterDate, aujourdhui } from '../utils/format';

const formulaireVide = () => ({
  client: { client_id: '', nom: '', telephone: '' },
  montant_initial: '', motif: '', date_dette: aujourdhui(), date_echeance: '', observation: '',
});

export default function Dettes() {
  const [donnees, setDonnees] = useState({ dettes: [], resume: { total_restant: 0, nombre_en_cours: 0, nombre_en_retard: 0 } });
  const [clients, setClients] = useState([]);
  const [statut, setStatut] = useState('en_cours');
  const [tri, setTri] = useState('reste');
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalNouvelle, setModalNouvelle] = useState(false);
  const [formulaire, setFormulaire] = useState(formulaireVide());
  const [paiement, setPaiement] = useState(null);
  const [ouvertes, setOuvertes] = useState({});

  const charger = async () => {
    try {
      setDonnees(await listerDettes({ statut, tri, q: recherche || undefined }));
    } catch {
      toast.error('Impossible de charger les dettes.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, [statut, tri, recherche]);
  useEffect(() => { listerClients().then(setClients).catch(() => {}); }, []);

  const soumettre = async (e) => {
    e.preventDefault();
    try {
      await creerDette({
        client_id: formulaire.client.client_id || undefined,
        personne_nom: formulaire.client.nom,
        telephone: formulaire.client.telephone,
        montant_initial: formulaire.montant_initial,
        motif: formulaire.motif,
        date_dette: formulaire.date_dette,
        date_echeance: formulaire.date_echeance || undefined,
        observation: formulaire.observation,
      });
      toast.success('Dette enregistrée.');
      setModalNouvelle(false);
      setFormulaire(formulaireVide());
      charger();
      listerClients().then(setClients).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const encaisser = async (e) => {
    e.preventDefault();
    try {
      await ajouterPaiementDette(paiement.dette.id, { montant: paiement.montant, note: paiement.note });
      setPaiement(null);
      toast.success('Versement enregistré.');
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const annulerVersement = async (dette, p) => {
    if (!confirm(`Annuler ce versement de ${formaterGNF(p.montant)} ?`)) return;
    await supprimerPaiementDette(dette.id, p.id);
    charger();
  };

  const supprimer = async (dette) => {
    if (!confirm(`Supprimer la dette de ${dette.personne_nom} ? Son historique de versements sera aussi supprimé.`)) return;
    await supprimerDette(dette.id);
    toast.success('Dette supprimée.');
    charger();
  };

  const { dettes, resume } = donnees;

  return (
    <div>
      <EnTete titre="Dettes clients" sousTitre="Les personnes qui doivent de l'argent à la boutique" icone={<FiCreditCard />}>
        <button onClick={() => setModalNouvelle(true)} className="btn-primary"><FiPlus /> Nouvelle dette</button>
      </EnTete>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icone={<FiCreditCard />} titre="Total à récupérer" valeur={formaterGNF(resume.total_restant)} teinte="rouge" />
        <Stat icone={<FiUsers />} titre="Personnes concernées" valeur={resume.nombre_en_cours} teinte="bleu" />
        <Stat icone={<FiAlertTriangle />} titre="En retard" valeur={resume.nombre_en_retard} detail="échéance dépassée" teinte={resume.nombre_en_retard ? 'orange' : 'gris'} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" />
          <input className="input-champ pl-10" placeholder="Rechercher une personne…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {[['en_cours', 'En cours'], ['soldee', 'Soldées'], ['toutes', 'Toutes']].map(([cle, label]) => (
            <button key={cle} onClick={() => setStatut(cle)}
              className={`text-xs font-medium px-3 py-2 rounded-full transition ${statut === cle ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={tri} onChange={(e) => setTri(e.target.value)} className="input-champ !w-auto !py-2 text-xs">
          <option value="reste">Trier : plus grosses d'abord</option>
          <option value="date">Trier : plus anciennes d'abord</option>
        </select>
      </div>

      {chargement ? (
        <p className="text-slate-400 text-sm py-10 text-center">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {dettes.map((d) => (
            <div key={d.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    {d.personne_nom}
                    {d.soldee && <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Soldée</span>}
                    {d.en_retard && <span className="badge bg-red-50 text-red-700 ring-red-200">En retard</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {d.motif || 'Sans motif'} · depuis le {formaterDate(d.date_dette)}
                    {d.date_echeance ? ` · échéance le ${formaterDate(d.date_echeance)}` : ''}
                  </p>
                  {d.telephone && <p className="text-xs text-slate-400 mt-0.5">{d.telephone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Reste à payer</p>
                  <p className={`text-xl font-bold ${d.soldee ? 'text-emerald-600' : 'text-red-600'}`}>{formaterGNF(d.reste)}</p>
                  <p className="text-xs text-slate-400">sur {formaterGNF(d.montant_initial)}</p>
                </div>
              </div>

              {!d.soldee && (
                <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (d.total_paye / Number(d.montant_initial)) * 100)}%` }} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {!d.soldee && <button onClick={() => setPaiement({ dette: d, montant: d.reste, note: '' })} className="btn-primary !py-2 text-xs">Encaisser un versement</button>}
                <BoutonsContact telephone={d.telephone}
                  message={`Bonjour ${d.personne_nom}, un petit rappel de la boutique Koloun Luxure : il reste ${formaterGNF(d.reste)} à régler${d.motif ? ` (${d.motif})` : ''}. Merci !`} />
                <button onClick={() => supprimer(d)} className="ml-auto p-2 text-slate-400 hover:text-red-600" title="Supprimer"><FiTrash2 size={15} /></button>
              </div>

              {d.paiements?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <button onClick={() => setOuvertes({ ...ouvertes, [d.id]: !ouvertes[d.id] })} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                    {ouvertes[d.id] ? <FiChevronUp /> : <FiChevronDown />} {d.paiements.length} versement(s) — {formaterGNF(d.total_paye)} reçus
                  </button>
                  {ouvertes[d.id] && (
                    <ul className="mt-2 space-y-1">
                      {d.paiements.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                          <span>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}{p.note ? ` · ${p.note}` : ''}</span>
                          <span className="flex items-center gap-2 font-medium">
                            {formaterGNF(p.montant)}
                            <button onClick={() => annulerVersement(d, p)} className="text-slate-300 hover:text-red-600" title="Annuler ce versement"><FiTrash2 size={12} /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
          {dettes.length === 0 && (
            <div className="text-center py-14 text-slate-400">
              <FiCreditCard className="mx-auto mb-2" size={28} />
              <p className="text-sm">{statut === 'en_cours' ? 'Personne ne vous doit d\'argent. 🎉' : 'Aucune dette.'}</p>
            </div>
          )}
        </div>
      )}

      {modalNouvelle && (
        <Modal titre="Nouvelle dette" onClose={() => setModalNouvelle(false)}>
          <form onSubmit={soumettre} className="space-y-4">
            <ChampClient clients={clients} valeur={formulaire.client} onChange={(client) => setFormulaire({ ...formulaire, client })} libelleNom="Nom de la personne" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="etiquette">Montant dû (GNF)</label>
                <input required type="number" min="1" className="input-champ" value={formulaire.montant_initial} onChange={(e) => setFormulaire({ ...formulaire, montant_initial: e.target.value })} />
              </div>
              <div>
                <label className="etiquette">Motif</label>
                <input className="input-champ" placeholder="Ex : 2 chemises prises à crédit" value={formulaire.motif} onChange={(e) => setFormulaire({ ...formulaire, motif: e.target.value })} />
              </div>
              <div>
                <label className="etiquette">Date de la dette</label>
                <input required type="date" className="input-champ" value={formulaire.date_dette} onChange={(e) => setFormulaire({ ...formulaire, date_dette: e.target.value })} />
              </div>
              <div>
                <label className="etiquette">Échéance (facultatif)</label>
                <input type="date" className="input-champ" value={formulaire.date_echeance} onChange={(e) => setFormulaire({ ...formulaire, date_echeance: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="etiquette">Observation (facultatif)</label>
              <input className="input-champ" value={formulaire.observation} onChange={(e) => setFormulaire({ ...formulaire, observation: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalNouvelle(false)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {paiement && (
        <Modal titre={`Versement — ${paiement.dette.personne_nom}`} onClose={() => setPaiement(null)}>
          <form onSubmit={encaisser} className="space-y-4">
            <p className="text-sm text-slate-600">Reste dû : <strong className="text-red-600">{formaterGNF(paiement.dette.reste)}</strong></p>
            <div>
              <label className="etiquette">Montant reçu (GNF)</label>
              <input required type="number" min="1" max={paiement.dette.reste} className="input-champ" value={paiement.montant} onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Note (facultatif)</label>
              <input className="input-champ" value={paiement.note} onChange={(e) => setPaiement({ ...paiement, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPaiement(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Valider</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
