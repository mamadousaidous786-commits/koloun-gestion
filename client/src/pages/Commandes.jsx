import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiTruck, FiTrash2, FiLayers, FiLock, FiCheckCircle, FiPackage } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import { listerCommandes, creerCommande, mettreAJourTransport, supprimerCommande } from '../services/commandeService';
import { listerGroupes, creerGroupe, validerTransportGroupe, supprimerGroupe } from '../services/groupeCommandeService';
import { listerFournisseurs, creerFournisseur } from '../services/fournisseurService';
import { formaterGNF, formaterDate, aujourdhui } from '../utils/format';

const formulaireCommande = (groupeId = '') => ({
  fournisseur_id: '', nom_commande: '', montant_total: '', quantite_totale: '', transport: '', date_commande: aujourdhui(), groupe_id: groupeId,
});

export default function Commandes() {
  const [commandes, setCommandes] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [formulaire, setFormulaire] = useState(null);       // nouvelle commande (modal)
  const [groupeModal, setGroupeModal] = useState(null);     // nouveau groupe (modal)
  const [nouveauFournisseur, setNouveauFournisseur] = useState('');
  const [transports, setTransports] = useState({});         // saisies de transport par groupe / commande
  const [periode, setPeriode] = useState('mois');
  const [dateFiltre, setDateFiltre] = useState(aujourdhui());

  const charger = () => {
    listerCommandes({ periode, date: dateFiltre }).then(setCommandes).catch(() => {});
    listerGroupes().then(setGroupes).catch(() => {});
    listerFournisseurs().then(setFournisseurs).catch(() => {});
  };
  useEffect(charger, [periode, dateFiltre]);

  const seules = useMemo(() => commandes.filter((c) => !c.groupe_id), [commandes]);
  const groupesAffiches = useMemo(() => {
    const mois = dateFiltre.slice(0, 7);
    return groupes.filter((g) => (periode === 'jour' ? String(g.date_commande).slice(0, 10) === dateFiltre : String(g.date_commande).slice(0, 7) === mois));
  }, [groupes, periode, dateFiltre]);

  const ajouterFournisseur = async () => {
    if (!nouveauFournisseur.trim()) return;
    const f = await creerFournisseur({ nom: nouveauFournisseur });
    setFournisseurs([...fournisseurs, f]);
    setFormulaire({ ...formulaire, fournisseur_id: f.id });
    setNouveauFournisseur('');
  };

  const soumettreCommande = async (e) => {
    e.preventDefault();
    try {
      await creerCommande({ ...formulaire, groupe_id: formulaire.groupe_id || undefined });
      toast.success('Commande enregistrée.');
      setFormulaire(null);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const soumettreGroupe = async (e) => {
    e.preventDefault();
    try {
      await creerGroupe(groupeModal);
      toast.success('Groupe créé. Ajoutez-y vos commandes.');
      setGroupeModal(null);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const validerTransport = async (g, piecesTotal) => {
    const valeur = transports[`g${g.id}`];
    if (valeur === undefined || valeur === '') return toast.warn('Saisissez le montant total du transport.');
    const parPiece = Math.round(Number(valeur) / piecesTotal);
    if (!confirm(`Valider ${formaterGNF(valeur)} de transport pour tout le groupe ?\n\n${formaterGNF(parPiece)} par pièce (${piecesTotal} pièces).\nAprès validation, il n'est plus possible de le modifier.`)) return;
    try {
      await validerTransportGroupe(g.id, valeur);
      toast.success('Transport validé et réparti.');
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const enregistrerTransportSeul = async (id) => {
    const valeur = transports[`c${id}`];
    if (valeur === undefined) return;
    await mettreAJourTransport(id, valeur);
    toast.success('Transport mis à jour.');
    charger();
  };

  const supprimerCmd = async (c) => {
    if (!confirm('Supprimer cette commande ?')) return;
    try { await supprimerCommande(c.id); charger(); } catch (err) { toast.error(err.response?.data?.message || 'Erreur.'); }
  };

  const supprimerLeGroupe = async (g) => {
    if (!confirm(`Supprimer le groupe « ${g.nom} » ? Ses commandes sont conservées (détachées).`)) return;
    try { await supprimerGroupe(g.id); charger(); } catch (err) { toast.error(err.response?.data?.message || 'Erreur.'); }
  };

  const Statut = ({ c }) => (
    <span className={`badge ${c.statut === 'amortie' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {c.statut === 'amortie' ? 'Objectif atteint' : 'En cours'}
    </span>
  );

  return (
    <div>
      <EnTete titre="Commandes fournisseurs" sousTitre="Regroupez les commandes arrivées ensemble pour partager le transport" icone={<FiTruck />}>
        <button onClick={() => setGroupeModal({ nom: '', date_commande: aujourdhui() })} className="btn-secondary"><FiLayers /> Nouveau groupe</button>
        <button onClick={() => setFormulaire(formulaireCommande())} className="btn-primary"><FiPlus /> Nouvelle commande</button>
      </EnTete>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="input-champ !w-auto">
          <option value="jour">Journalier</option>
          <option value="mois">Mensuel</option>
        </select>
        <input type="date" value={dateFiltre} onChange={(e) => setDateFiltre(e.target.value)} className="input-champ !w-auto" />
      </div>

      {/* ---------------- Groupes de commande ---------------- */}
      {groupesAffiches.length > 0 && (
        <div className="space-y-4 mb-8">
          {groupesAffiches.map((g) => {
            const cmds = g.Commandes || [];
            const pieces = cmds.reduce((a, c) => a + Number(c.quantite_totale), 0);
            const montant = cmds.reduce((a, c) => a + Number(c.montant_total), 0);
            const saisie = transports[`g${g.id}`];
            const apercu = pieces > 0 && saisie ? Math.round(Number(saisie) / pieces) : null;
            return (
              <div key={g.id} className="card !p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-marine-800 to-marine-700 text-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><FiLayers /></span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{g.nom}</p>
                      <p className="text-xs text-blue-100/70">{formaterDate(g.date_commande)} · {cmds.length} commande(s) · {pieces} pièce(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.transport_valide
                      ? <span className="badge bg-emerald-400/20 text-emerald-100"><FiLock size={11} /> Transport validé</span>
                      : <span className="badge bg-amber-400/20 text-amber-100">Transport à valider</span>}
                    {!g.transport_valide && <button onClick={() => supprimerLeGroupe(g)} className="p-2 text-blue-100/60 hover:text-white" title="Supprimer le groupe"><FiTrash2 size={15} /></button>}
                  </div>
                </div>

                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-100">
                          <th className="pb-2 font-medium">Article / commande</th>
                          <th className="pb-2 font-medium">Fournisseur</th>
                          <th className="pb-2 font-medium text-right">Qté</th>
                          <th className="pb-2 font-medium text-right">Montant</th>
                          <th className="pb-2 font-medium text-right">Transport</th>
                          <th className="pb-2 font-medium text-right">Coût réel / pièce</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cmds.map((c) => (
                          <tr key={c.id} className="border-b border-slate-50">
                            <td className="py-2.5 font-medium text-slate-900">{c.nom_commande || `Commande #${c.id}`}</td>
                            <td className="py-2.5 text-slate-500">{c.Fournisseur?.nom}</td>
                            <td className="py-2.5 text-right">{c.quantite_totale}</td>
                            <td className="py-2.5 text-right whitespace-nowrap">{formaterGNF(c.montant_total)}</td>
                            <td className="py-2.5 text-right whitespace-nowrap">{g.transport_valide ? formaterGNF(c.transport) : <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 text-right whitespace-nowrap font-semibold text-blue-700">{g.transport_valide ? formaterGNF(c.cout_reel) : <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 text-right">
                              {!g.transport_valide && <button onClick={() => supprimerCmd(c)} className="text-slate-300 hover:text-red-600"><FiTrash2 size={14} /></button>}
                            </td>
                          </tr>
                        ))}
                        {cmds.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">Aucune commande dans ce groupe pour l'instant.</td></tr>}
                      </tbody>
                      {cmds.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold text-slate-900">
                            <td className="pt-3" colSpan={2}>Total du groupe</td>
                            <td className="pt-3 text-right">{pieces}</td>
                            <td className="pt-3 text-right whitespace-nowrap">{formaterGNF(montant)}</td>
                            <td className="pt-3 text-right whitespace-nowrap">{g.transport_valide ? formaterGNF(g.transport) : ''}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {!g.transport_valide ? (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <button onClick={() => setFormulaire(formulaireCommande(g.id))} className="btn-secondary"><FiPlus /> Ajouter une commande</button>
                      <div className="flex-1 min-w-[14rem]">
                        <label className="etiquette">Transport total du groupe (réparti sur toutes les pièces)</label>
                        <input type="number" min="0" placeholder="Ex : 10000" value={saisie ?? ''} onChange={(e) => setTransports({ ...transports, [`g${g.id}`]: e.target.value })} className="input-champ" />
                        {apercu !== null && <p className="text-xs text-blue-700 mt-1">≈ {formaterGNF(apercu)} de transport par pièce ({pieces} pièces)</p>}
                      </div>
                      <button onClick={() => validerTransport(g, pieces)} disabled={cmds.length === 0} className="btn-primary"><FiCheckCircle /> Valider le transport</button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600 flex items-center gap-2">
                      <FiLock className="text-emerald-600" /> {formaterGNF(g.transport)} de transport réparti sur {pieces} pièces, soit <b className="text-slate-900">{formaterGNF(pieces ? Number(g.transport) / pieces : 0)}</b> par pièce. Définitif.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- Commandes isolées ---------------- */}
      {(seules.length > 0 || groupesAffiches.length === 0) && (
        <>
          {groupesAffiches.length > 0 && <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><FiPackage className="text-blue-600" /> Commandes seules</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seules.map((c) => (
              <div key={c.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{c.nom_commande || `Commande #${c.id}`}</p>
                    <p className="text-xs text-slate-500">{c.Fournisseur?.nom} · {formaterDate(c.date_commande)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Statut c={c} />
                    <button onClick={() => supprimerCmd(c)} className="text-slate-300 hover:text-red-600"><FiTrash2 size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div><p className="text-xs text-slate-500">Montant total</p><p>{formaterGNF(c.montant_total)}</p></div>
                  <div><p className="text-xs text-slate-500">Quantité</p><p>{c.quantite_totale}</p></div>
                  <div><p className="text-xs text-slate-500">Prix unitaire</p><p>{formaterGNF(c.prix_unitaire)}</p></div>
                  <div><p className="text-xs text-slate-500">Transport unitaire</p><p>{formaterGNF(c.transport_unitaire)}</p></div>
                  <div><p className="text-xs text-slate-500">Coût réel / pièce</p><p className="font-semibold text-blue-700">{formaterGNF(c.cout_reel)}</p></div>
                  <div><p className="text-xs text-slate-500">Objectif à atteindre</p><p className="font-semibold text-blue-700">{formaterGNF(c.objectif)}</p></div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="etiquette">Transport (à définir à l'arrivée)</label>
                    <input type="number" placeholder="Montant transport" defaultValue={c.transport} onChange={(e) => setTransports({ ...transports, [`c${c.id}`]: e.target.value })} className="input-champ" />
                  </div>
                  <button onClick={() => enregistrerTransportSeul(c.id)} className="btn-secondary">OK</button>
                </div>
              </div>
            ))}
            {seules.length === 0 && groupesAffiches.length === 0 && (
              <p className="col-span-full text-center py-10 text-slate-400">Aucune commande pour cette période.</p>
            )}
          </div>
        </>
      )}

      {/* ---------------- Modals ---------------- */}
      {formulaire && (
        <Modal titre={formulaire.groupe_id ? 'Ajouter une commande au groupe' : 'Nouvelle commande'} onClose={() => setFormulaire(null)}>
          <form onSubmit={soumettreCommande} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <select required className="input-champ" value={formulaire.fournisseur_id} onChange={(e) => setFormulaire({ ...formulaire, fournisseur_id: e.target.value })}>
                <option value="">-- Fournisseur --</option>
                {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <input placeholder="Ajouter un nouveau fournisseur" className="input-champ flex-1" value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} />
              <button type="button" onClick={ajouterFournisseur} className="btn-secondary">Ajouter</button>
            </div>
            <div className="col-span-2">
              <label className="etiquette">Groupe (facultatif)</label>
              <select className="input-champ" value={formulaire.groupe_id} onChange={(e) => setFormulaire({ ...formulaire, groupe_id: e.target.value })}>
                <option value="">Commande seule (transport à part)</option>
                {groupes.filter((g) => !g.transport_valide).map((g) => <option key={g.id} value={g.id}>{g.nom} — {formaterDate(g.date_commande)}</option>)}
              </select>
            </div>
            <input placeholder="Nom de la commande (ex : T-shirts)" className="input-champ col-span-2" value={formulaire.nom_commande} onChange={(e) => setFormulaire({ ...formulaire, nom_commande: e.target.value })} />
            <input required type="number" placeholder="Montant total" className="input-champ" value={formulaire.montant_total} onChange={(e) => setFormulaire({ ...formulaire, montant_total: e.target.value })} />
            <input required type="number" placeholder="Quantité totale" className="input-champ" value={formulaire.quantite_totale} onChange={(e) => setFormulaire({ ...formulaire, quantite_totale: e.target.value })} />
            {!formulaire.groupe_id && (
              <input type="number" placeholder="Transport (facultatif)" className="input-champ" value={formulaire.transport} onChange={(e) => setFormulaire({ ...formulaire, transport: e.target.value })} />
            )}
            <input required type="date" className={`input-champ ${formulaire.groupe_id ? 'col-span-2' : ''}`} value={formulaire.date_commande} onChange={(e) => setFormulaire({ ...formulaire, date_commande: e.target.value })} />
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setFormulaire(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {groupeModal && (
        <Modal titre="Nouveau groupe de commande" onClose={() => setGroupeModal(null)}>
          <p className="text-sm text-slate-500 mb-4">Un groupe réunit les commandes passées séparément le même jour et qui arrivent ensemble : le transport est saisi une seule fois puis réparti sur toutes les pièces.</p>
          <form onSubmit={soumettreGroupe} className="space-y-3">
            <input required autoFocus placeholder="Nom du groupe (ex : Arrivage du 12 novembre)" className="input-champ" value={groupeModal.nom} onChange={(e) => setGroupeModal({ ...groupeModal, nom: e.target.value })} />
            <input required type="date" className="input-champ" value={groupeModal.date_commande} onChange={(e) => setGroupeModal({ ...groupeModal, date_commande: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setGroupeModal(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Créer le groupe</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
