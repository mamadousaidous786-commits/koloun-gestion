import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiUser, FiEdit2, FiTrash2, FiPhone } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import BoutonsContact from '../components/BoutonsContact';
import { listerClients, obtenirClient, creerClient, modifierClient, supprimerClient } from '../services/clientService';
import { useAuth } from '../context/AuthContext';
import { formaterGNF, formaterDate } from '../utils/format';

const vide = { nom: '', telephone: '', adresse: '', notes: '' };

export default function Clients() {
  const { estAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState(null); // { id?, nom, telephone, adresse, notes }
  const [fiche, setFiche] = useState(null);

  const charger = async () => {
    try {
      setClients(await listerClients(recherche || undefined));
    } catch {
      toast.error('Impossible de charger les clients.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, [recherche]);

  const ouvrirFiche = async (id) => {
    try {
      setFiche(await obtenirClient(id));
    } catch {
      toast.error('Impossible de charger la fiche.');
    }
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      if (formulaire.id) await modifierClient(formulaire.id, formulaire);
      else await creerClient(formulaire);
      toast.success('Client enregistré.');
      setFormulaire(null);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const supprimer = async (client) => {
    if (!confirm(`Supprimer ${client.nom} ? Ses achats, commandes et dettes restent enregistrés.`)) return;
    await supprimerClient(client.id);
    setFiche(null);
    toast.success('Client supprimé.');
    charger();
  };

  return (
    <div>
      <EnTete titre="Clients" sousTitre="Votre carnet de clients, avec leur historique" icone={<FiUser />}>
        <button onClick={() => setFormulaire({ ...vide })} className="btn-primary"><FiPlus /> Nouveau client</button>
      </EnTete>

      <div className="relative mb-5 max-w-sm">
        <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" />
        <input className="input-champ pl-10" placeholder="Rechercher par nom ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>

      {chargement ? (
        <p className="text-slate-400 text-sm py-10 text-center">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.map((c) => (
            <button key={c.id} onClick={() => ouvrirFiche(c.id)} className="card text-left hover:border-blue-300 hover:shadow-md transition flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                {c.nom.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{c.nom}</p>
                <p className="text-sm text-slate-500 truncate flex items-center gap-1">{c.telephone ? <><FiPhone size={12} /> {c.telephone}</> : 'Pas de téléphone'}</p>
              </div>
            </button>
          ))}
          {clients.length === 0 && (
            <div className="col-span-full text-center py-14 text-slate-400">
              <FiUser className="mx-auto mb-2" size={28} />
              <p className="text-sm">Aucun client{recherche ? ' trouvé' : ' pour le moment'}. Ils s'ajoutent aussi automatiquement depuis les commandes spéciales et les dettes.</p>
            </div>
          )}
        </div>
      )}

      {/* Fiche client */}
      {fiche && (
        <Modal titre={fiche.client.nom} onClose={() => setFiche(null)} large>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div className="text-sm text-slate-600 space-y-0.5">
              {fiche.client.telephone && <p>📞 {fiche.client.telephone}</p>}
              {fiche.client.adresse && <p>📍 {fiche.client.adresse}</p>}
              {fiche.client.notes && <p className="text-slate-500">📝 {fiche.client.notes}</p>}
              <p className="text-xs text-slate-400">Client depuis le {formaterDate(fiche.client.created_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BoutonsContact telephone={fiche.client.telephone} />
              <button onClick={() => { setFormulaire({ ...fiche.client }); setFiche(null); }} className="btn-secondary !py-1.5 text-xs"><FiEdit2 size={13} /> Modifier</button>
              {estAdmin && <button onClick={() => supprimer(fiche.client)} className="btn-danger !py-1.5 text-xs"><FiTrash2 size={13} /></button>}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-700/70">Total des achats</p><p className="font-bold text-blue-900">{formaterGNF(fiche.total_achats)}</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Nombre d'achats</p><p className="font-bold text-slate-900">{fiche.nombre_achats}</p></div>
            <div className={`rounded-xl p-3 ${fiche.reste_commandes > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}><p className="text-xs text-slate-500">Reste sur commandes</p><p className="font-bold text-slate-900">{formaterGNF(fiche.reste_commandes)}</p></div>
            <div className={`rounded-xl p-3 ${fiche.reste_dettes > 0 ? 'bg-red-50' : 'bg-slate-50'}`}><p className="text-xs text-slate-500">Dettes en cours</p><p className={`font-bold ${fiche.reste_dettes > 0 ? 'text-red-600' : 'text-slate-900'}`}>{formaterGNF(fiche.reste_dettes)}</p></div>
          </div>

          <h3 className="text-sm font-semibold text-slate-900 mb-2">Derniers achats</h3>
          {fiche.ventes.length === 0 ? <p className="text-sm text-slate-400 mb-5">Aucun achat enregistré. Choisissez ce client lors d'une vente pour suivre son historique.</p> : (
            <ul className="mb-5 divide-y divide-slate-100 text-sm">
              {fiche.ventes.slice(0, 8).map((v) => (
                <li key={v.id} className="flex justify-between py-2">
                  <span className="text-slate-600">{v.numero_recu} · {new Date(v.date_vente).toLocaleDateString('fr-FR')} · {v.MoyenPaiement?.nom}</span>
                  <span className="font-medium">{formaterGNF(v.montant_total)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-sm font-semibold text-slate-900 mb-2">Commandes spéciales</h3>
          {fiche.commandes_speciales.length === 0 ? <p className="text-sm text-slate-400 mb-5">Aucune.</p> : (
            <ul className="mb-5 divide-y divide-slate-100 text-sm">
              {fiche.commandes_speciales.map((c) => (
                <li key={c.id} className="flex justify-between py-2">
                  <span className="text-slate-600">{c.article} · {c.statut.replace('_', ' ')}</span>
                  <span className={`font-medium ${c.reste > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.reste > 0 ? `reste ${formaterGNF(c.reste)}` : 'soldée'}</span>
                </li>
              ))}
            </ul>
          )}

          {estAdmin && (
            <>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Dettes</h3>
              {fiche.dettes.length === 0 ? <p className="text-sm text-slate-400">Aucune.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {fiche.dettes.map((d) => (
                    <li key={d.id} className="flex justify-between py-2">
                      <span className="text-slate-600">{d.motif || 'Dette'} · {formaterDate(d.date_dette)}</span>
                      <span className={`font-medium ${d.reste > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.reste > 0 ? `reste ${formaterGNF(d.reste)}` : 'soldée'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Modal>
      )}

      {/* Ajouter / modifier */}
      {formulaire && (
        <Modal titre={formulaire.id ? 'Modifier le client' : 'Nouveau client'} onClose={() => setFormulaire(null)}>
          <form onSubmit={enregistrer} className="space-y-4">
            <div>
              <label className="etiquette">Nom</label>
              <input required className="input-champ" value={formulaire.nom} onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Téléphone</label>
              <input className="input-champ" inputMode="tel" value={formulaire.telephone || ''} onChange={(e) => setFormulaire({ ...formulaire, telephone: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Adresse</label>
              <input className="input-champ" value={formulaire.adresse || ''} onChange={(e) => setFormulaire({ ...formulaire, adresse: e.target.value })} />
            </div>
            <div>
              <label className="etiquette">Notes</label>
              <textarea rows={2} className="input-champ" placeholder="Pointure, goûts, remarques…" value={formulaire.notes || ''} onChange={(e) => setFormulaire({ ...formulaire, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormulaire(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
