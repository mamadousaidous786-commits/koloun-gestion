import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiStar, FiTrash2, FiImage, FiCalendar, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import ChampClient from '../components/ChampClient';
import BoutonsContact from '../components/BoutonsContact';
import {
  listerCommandesSpeciales, creerCommandeSpeciale, changerStatutCommandeSpeciale,
  ajouterPaiementCommandeSpeciale, supprimerCommandeSpeciale,
} from '../services/commandeSpecialeService';
import { listerClients } from '../services/clientService';
import { useAuth } from '../context/AuthContext';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF, formaterDate, aujourdhui } from '../utils/format';

const STATUTS = {
  en_attente: { label: 'En attente', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  commandee: { label: 'Commandée', classe: 'bg-blue-50 text-blue-700 ring-blue-200' },
  arrivee: { label: 'Arrivée', classe: 'bg-violet-50 text-violet-700 ring-violet-200' },
  livree: { label: 'Livrée', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  annulee: { label: 'Annulée', classe: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

const MOYENS = [
  { id: 3, nom: 'Cash' },
  { id: 1, nom: 'Orange Money' },
  { id: 2, nom: 'Paiement Marchand' },
];

const formulaireVide = () => ({
  client: { client_id: '', nom: '', telephone: '' },
  article: '', details: '', prix_total: '', acompte: '', moyen_paiement_id: 3,
  date_livraison_prevue: '', observation: '', photo: null,
});

export default function CommandesSpeciales() {
  const { estAdmin } = useAuth();
  const [commandes, setCommandes] = useState([]);
  const [clients, setClients] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [modalNouvelle, setModalNouvelle] = useState(false);
  const [formulaire, setFormulaire] = useState(formulaireVide());
  const [enregistrement, setEnregistrement] = useState(false);
  const [paiement, setPaiement] = useState(null); // { commande, montant, moyen_paiement_id, note }
  const [ouvertes, setOuvertes] = useState({}); // historique des paiements déplié
  const inputPhoto = useRef(null);

  const charger = async () => {
    try {
      const data = await listerCommandesSpeciales({ statut: filtre || undefined, q: recherche || undefined });
      setCommandes(data);
    } catch {
      toast.error('Impossible de charger les commandes spéciales.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, [filtre, recherche]);
  useEffect(() => { listerClients().then(setClients).catch(() => {}); }, []);

  const remplacer = (maj) => setCommandes((liste) => liste.map((c) => (c.id === maj.id ? maj : c)));

  const soumettre = async (e) => {
    e.preventDefault();
    setEnregistrement(true);
    try {
      const fd = new FormData();
      fd.append('client_id', formulaire.client.client_id || '');
      fd.append('client_nom', formulaire.client.nom);
      fd.append('client_telephone', formulaire.client.telephone);
      fd.append('article', formulaire.article);
      fd.append('details', formulaire.details);
      fd.append('prix_total', formulaire.prix_total);
      if (Number(formulaire.acompte) > 0) {
        fd.append('acompte', formulaire.acompte);
        fd.append('moyen_paiement_id', formulaire.moyen_paiement_id);
      }
      fd.append('date_livraison_prevue', formulaire.date_livraison_prevue);
      fd.append('observation', formulaire.observation);
      if (formulaire.photo) fd.append('image', formulaire.photo);

      await creerCommandeSpeciale(fd);
      toast.success('Commande spéciale enregistrée.');
      setModalNouvelle(false);
      setFormulaire(formulaireVide());
      charger();
      listerClients().then(setClients).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  };

  const changerStatut = async (commande, statut) => {
    if (statut === 'livree' && commande.reste > 0 &&
      !confirm(`Il reste ${formaterGNF(commande.reste)} à payer. Marquer quand même comme livrée ?`)) return;
    try {
      remplacer(await changerStatutCommandeSpeciale(commande.id, statut));
      toast.success(`Statut : ${STATUTS[statut].label}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const encaisser = async (e) => {
    e.preventDefault();
    try {
      const maj = await ajouterPaiementCommandeSpeciale(paiement.commande.id, {
        montant: paiement.montant, moyen_paiement_id: paiement.moyen_paiement_id, note: paiement.note,
      });
      remplacer(maj);
      setPaiement(null);
      toast.success('Paiement enregistré.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const supprimer = async (commande) => {
    if (!confirm(`Supprimer la commande de ${commande.client_nom} (${commande.article}) ?`)) return;
    await supprimerCommandeSpeciale(commande.id);
    toast.success('Commande supprimée.');
    charger();
  };

  const enRetard = (c) => c.date_livraison_prevue && !['livree', 'annulee'].includes(c.statut) && String(c.date_livraison_prevue).slice(0, 10) < aujourdhui();

  return (
    <div>
      <EnTete titre="Commandes spéciales" sousTitre="Articles commandés pour vos clients, avec avance facultative" icone={<FiStar />}>
        <button onClick={() => setModalNouvelle(true)} className="btn-primary"><FiPlus /> Nouvelle commande</button>
      </EnTete>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" />
          <input className="input-champ pl-10" placeholder="Rechercher un client ou un article…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['', 'Toutes'], ...Object.entries(STATUTS).map(([k, v]) => [k, v.label])].map(([cle, label]) => (
            <button key={cle} onClick={() => setFiltre(cle)}
              className={`text-xs font-medium px-3 py-2 rounded-full transition ${filtre === cle ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {chargement ? (
        <p className="text-slate-400 text-sm py-10 text-center">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {commandes.map((c) => (
            <div key={c.id} className="card">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {c.image ? <img src={urlFichier(c.image)} alt="" className="w-full h-full object-cover" /> : <FiImage className="text-slate-300" size={24} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{c.article}</p>
                      <p className="text-sm text-slate-500 truncate">{c.client_nom}{c.client_telephone ? ` · ${c.client_telephone}` : ''}</p>
                    </div>
                    <span className={`badge shrink-0 ${STATUTS[c.statut].classe}`}>{STATUTS[c.statut].label}</span>
                  </div>
                  {c.details && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.details}</p>}
                  {c.date_livraison_prevue && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${enRetard(c) ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      <FiCalendar size={12} /> Livraison prévue le {formaterDate(c.date_livraison_prevue)}{enRetard(c) ? ' — en retard' : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-slate-50 rounded-xl py-2"><p className="text-[11px] text-slate-500">Prix</p><p className="text-sm font-semibold">{formaterGNF(c.prix_total)}</p></div>
                <div className="bg-slate-50 rounded-xl py-2"><p className="text-[11px] text-slate-500">Payé</p><p className="text-sm font-semibold text-emerald-600">{formaterGNF(c.total_paye)}</p></div>
                <div className={`rounded-xl py-2 ${c.reste > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <p className="text-[11px] text-slate-500">Reste</p>
                  <p className={`text-sm font-semibold ${c.reste > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.reste > 0 ? formaterGNF(c.reste) : 'Soldé'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <select value={c.statut} onChange={(e) => changerStatut(c, e.target.value)} className="input-champ !w-auto !py-2 text-xs">
                  {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {c.reste > 0 && c.statut !== 'annulee' && (
                  <button onClick={() => setPaiement({ commande: c, montant: c.reste, moyen_paiement_id: 3, note: '' })} className="btn-primary !py-2 text-xs">Encaisser</button>
                )}
                <BoutonsContact
                  telephone={c.client_telephone}
                  message={c.statut === 'arrivee'
                    ? `Bonjour ${c.client_nom}, votre commande « ${c.article} » est arrivée chez Koloun Luxure.${c.reste > 0 ? ` Il reste ${formaterGNF(c.reste)} à régler.` : ''}`
                    : `Bonjour ${c.client_nom}, concernant votre commande « ${c.article} » chez Koloun Luxure.`}
                />
                {estAdmin && (
                  <button onClick={() => supprimer(c)} className="ml-auto p-2 text-slate-400 hover:text-red-600" title="Supprimer"><FiTrash2 size={15} /></button>
                )}
              </div>

              {c.paiements?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <button onClick={() => setOuvertes({ ...ouvertes, [c.id]: !ouvertes[c.id] })} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                    {ouvertes[c.id] ? <FiChevronUp /> : <FiChevronDown />} {c.paiements.length} versement(s)
                  </button>
                  {ouvertes[c.id] && (
                    <ul className="mt-2 space-y-1">
                      {c.paiements.map((p) => (
                        <li key={p.id} className="flex justify-between text-xs text-slate-600">
                          <span>{new Date(p.date_paiement).toLocaleDateString('fr-FR')} · {p.MoyenPaiement?.nom || '—'}{p.note ? ` · ${p.note}` : ''}</span>
                          <span className="font-medium">{formaterGNF(p.montant)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
          {commandes.length === 0 && (
            <div className="col-span-full text-center py-14 text-slate-400">
              <FiStar className="mx-auto mb-2" size={28} />
              <p className="text-sm">Aucune commande spéciale{filtre ? ' avec ce statut' : ''}.</p>
            </div>
          )}
        </div>
      )}

      {/* Nouvelle commande */}
      {modalNouvelle && (
        <Modal titre="Nouvelle commande spéciale" onClose={() => setModalNouvelle(false)}>
          <form onSubmit={soumettre} className="space-y-4">
            <ChampClient clients={clients} valeur={formulaire.client} onChange={(client) => setFormulaire({ ...formulaire, client })} />

            <div>
              <label className="etiquette">Article demandé</label>
              <input required className="input-champ" placeholder="Ex : Robe de soirée bleu nuit" value={formulaire.article} onChange={(e) => setFormulaire({ ...formulaire, article: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Détails (taille, couleur, précisions)</label>
              <textarea rows={2} className="input-champ" value={formulaire.details} onChange={(e) => setFormulaire({ ...formulaire, details: e.target.value })} />
            </div>

            <div>
              <label className="etiquette">Photo de référence (facultatif)</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => inputPhoto.current.click()} className="btn-secondary !py-2 text-xs"><FiImage /> {formulaire.photo ? 'Changer la photo' : 'Ajouter une photo'}</button>
                {formulaire.photo && <span className="text-xs text-slate-500 truncate">{formulaire.photo.name}</span>}
                <input ref={inputPhoto} type="file" accept="image/*" className="hidden" onChange={(e) => setFormulaire({ ...formulaire, photo: e.target.files[0] || null })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="etiquette">Prix total (GNF)</label>
                <input required type="number" min="1" className="input-champ" value={formulaire.prix_total} onChange={(e) => setFormulaire({ ...formulaire, prix_total: e.target.value })} />
              </div>
              <div>
                <label className="etiquette">Avance versée (facultatif)</label>
                <input type="number" min="0" className="input-champ" placeholder="Laisser vide si aucune" value={formulaire.acompte} onChange={(e) => setFormulaire({ ...formulaire, acompte: e.target.value })} />
              </div>
            </div>

            {Number(formulaire.acompte) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="etiquette">Avance payée par</label>
                  <select className="input-champ" value={formulaire.moyen_paiement_id} onChange={(e) => setFormulaire({ ...formulaire, moyen_paiement_id: e.target.value })}>
                    {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
                <p className="text-sm font-medium text-slate-700 pb-2.5">
                  Reste à payer : <span className="text-red-600">{formaterGNF(Math.max(0, Number(formulaire.prix_total || 0) - Number(formulaire.acompte)))}</span>
                </p>
              </div>
            )}

            <div>
              <label className="etiquette">Date de livraison prévue (facultatif)</label>
              <input type="date" className="input-champ" value={formulaire.date_livraison_prevue} onChange={(e) => setFormulaire({ ...formulaire, date_livraison_prevue: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Observation (facultatif)</label>
              <input className="input-champ" value={formulaire.observation} onChange={(e) => setFormulaire({ ...formulaire, observation: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalNouvelle(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={enregistrement} className="btn-primary">{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Encaisser un paiement */}
      {paiement && (
        <Modal titre={`Encaisser — ${paiement.commande.client_nom}`} onClose={() => setPaiement(null)}>
          <form onSubmit={encaisser} className="space-y-4">
            <p className="text-sm text-slate-600">{paiement.commande.article} · reste à payer <strong className="text-red-600">{formaterGNF(paiement.commande.reste)}</strong></p>
            <div>
              <label className="etiquette">Montant reçu (GNF)</label>
              <input required type="number" min="1" max={paiement.commande.reste} className="input-champ" value={paiement.montant} onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Payé par</label>
              <select className="input-champ" value={paiement.moyen_paiement_id} onChange={(e) => setPaiement({ ...paiement, moyen_paiement_id: e.target.value })}>
                {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="etiquette">Note (facultatif)</label>
              <input className="input-champ" value={paiement.note} onChange={(e) => setPaiement({ ...paiement, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPaiement(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Valider le paiement</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
