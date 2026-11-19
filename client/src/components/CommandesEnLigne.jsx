import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiShoppingBag, FiCheck, FiX, FiMapPin, FiHome, FiImage } from 'react-icons/fi';
import Modal from './Modal';
import BoutonsContact from './BoutonsContact';
import { commandesAConfirmer, accepterCommande, refuserCommande } from '../services/commandeEnLigneService';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF, aujourdhui } from '../utils/format';

const prixLigne = (l) => (l.prix_negocie ?? l.prix_unitaire) * l.quantite;

// Section « À confirmer (boutique en ligne) » en haut de la page Livraisons.
// Accepter → la commande devient une livraison (le client la voit « Expédiée »), Refuser → le client voit le motif.
export default function CommandesEnLigne({ jour, onAccepte }) {
  const [liste, setListe] = useState([]);
  const [chargee, setChargee] = useState(false);
  const [acceptation, setAcceptation] = useState(null); // { commande, frais, livreur, remise, date }
  const [refus, setRefus] = useState(null); // { commande, motif }
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    commandesAConfirmer().then(setListe).catch(() => {}).finally(() => setChargee(true));
  }, []);
  useEffect(() => {
    charger();
    const t = setInterval(charger, 60000); // nouvelles commandes visibles sans recharger la page
    return () => clearInterval(t);
  }, [charger]);

  const accepter = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const r = await accepterCommande(acceptation.commande.id, {
        frais_livraison: acceptation.frais || 0,
        livreur: acceptation.livreur,
        remise: acceptation.remise === '' ? undefined : acceptation.remise,
        date_livraison: acceptation.date,
      });
      toast.success(`Commande acceptée → livraison ${r.livraison_numero}`);
      setAcceptation(null);
      charger();
      onAccepte?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "La commande n'a pas pu être acceptée.");
    } finally { setEnvoi(false); }
  };

  const refuser = async (e) => {
    e.preventDefault();
    if (!refus.motif.trim()) return toast.error('Indiquez le motif : le client le verra.');
    setEnvoi(true);
    try {
      await refuserCommande(refus.commande.id, refus.motif.trim());
      toast.success('Commande refusée');
      setRefus(null);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || "La commande n'a pas pu être refusée.");
    } finally { setEnvoi(false); }
  };

  if (!chargee || liste.length === 0) return null;

  const a = acceptation;
  const sousTotal = a ? a.commande.lignes.reduce((s, l) => s + prixLigne(l), 0) : 0;
  const totalArticles = a ? Math.max(0, sousTotal - (Number(a.remise) || 0)) : 0;
  const frais = a && a.commande.mode_livraison !== 'retrait' ? Number(a.frais) || 0 : 0;

  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
        <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center"><FiShoppingBag size={15} /></span>
        À confirmer (boutique en ligne)
        <span className="ml-1 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{liste.length}</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {liste.map((c) => (
          <div key={c.id} className="card !p-4 ring-2 ring-blue-100 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{c.client_nom}</p>
                <p className="text-xs text-slate-500">{c.reference} · {new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
              <p className="text-right shrink-0">
                <span className="block font-bold text-slate-900 tabular-nums">{formaterGNF(c.total_final)}</span>
                {c.total_final < c.total_initial && <s className="text-xs text-slate-400">{formaterGNF(c.total_initial)}</s>}
              </p>
            </div>

            <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 w-fit ${c.mode_livraison === 'retrait' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
              {c.mode_livraison === 'retrait' ? <><FiHome size={13} /> Retrait en boutique</> : <><FiMapPin size={13} /> Livraison : {c.adresse || 'adresse à demander au client'}</>}
            </p>

            <ul className="mt-3 space-y-2 flex-1">
              {c.lignes.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {l.image ? <img src={urlFichier(l.image, 150)} alt="" className="w-full h-full object-cover" /> : <FiImage className="text-slate-300" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-800 truncate">{l.nom}</span>
                    <span className="block text-xs text-slate-500">{l.taille ? `Taille ${l.taille} · ` : ''}Qté {l.quantite}</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formaterGNF(prixLigne(l))}</span>
                </li>
              ))}
            </ul>
            {c.note_client && <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">« {c.note_client} »</p>}

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <BoutonsContact telephone={c.client_telephone} message={`Bonjour ${c.client_nom}, nous avons bien reçu votre commande ${c.reference} (Koloun Luxure).`} />
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setRefus({ commande: c, motif: '' })} className="btn-secondary !py-2"><FiX /> Refuser</button>
                <button onClick={() => setAcceptation({ commande: c, frais: '', livreur: '', remise: c.remise || '', date: jour || aujourdhui() })} className="btn-primary !py-2"><FiCheck /> Accepter</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {a && (
        <Modal titre={`Accepter la commande ${a.commande.reference}`} onClose={() => setAcceptation(null)}>
          <form onSubmit={accepter} className="space-y-4">
            <p className="text-sm text-slate-600">
              La commande devient une livraison du {new Date(a.date).toLocaleDateString('fr-FR')}. Le client la verra
              {a.commande.mode_livraison === 'retrait' ? ' « Prête à retirer ».' : ' « Expédiée ».'}
            </p>
            {a.commande.mode_livraison !== 'retrait' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="etiquette">Frais de livraison (GNF)</label><input className="input-champ" type="number" inputMode="numeric" min="0" step="5000" value={a.frais} onChange={(e) => setAcceptation({ ...a, frais: e.target.value })} placeholder="0" autoFocus /></div>
                <div><label className="etiquette">Livreur (facultatif)</label><input className="input-champ" value={a.livreur} onChange={(e) => setAcceptation({ ...a, livreur: e.target.value })} /></div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="etiquette">Réduction accordée (GNF)</label><input className="input-champ" type="number" inputMode="numeric" min="0" step="5000" value={a.remise} onChange={(e) => setAcceptation({ ...a, remise: e.target.value })} placeholder="0" /></div>
              <div><label className="etiquette">Date de livraison</label><input className="input-champ" type="date" value={a.date} onChange={(e) => setAcceptation({ ...a, date: e.target.value || aujourdhui() })} /></div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1 tabular-nums">
              <p className="flex justify-between"><span>Articles</span><span>{formaterGNF(totalArticles)}</span></p>
              {frais > 0 && <p className="flex justify-between"><span>Frais de livraison</span><span>{formaterGNF(frais)}</span></p>}
              <p className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200"><span>À encaisser auprès du client</span><span>{formaterGNF(totalArticles + frais)}</span></p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAcceptation(null)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={envoi} className="btn-primary">{envoi ? 'Validation…' : 'Accepter la commande'}</button>
            </div>
          </form>
        </Modal>
      )}

      {refus && (
        <Modal titre={`Refuser la commande ${refus.commande.reference}`} onClose={() => setRefus(null)}>
          <form onSubmit={refuser} className="space-y-4">
            <div>
              <label className="etiquette">Motif (le client le verra dans ses commandes)</label>
              <input className="input-champ" value={refus.motif} onChange={(e) => setRefus({ ...refus, motif: e.target.value })} placeholder="Ex. : taille plus disponible" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRefus(null)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={envoi} className="btn-danger">{envoi ? 'Envoi…' : 'Refuser la commande'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
