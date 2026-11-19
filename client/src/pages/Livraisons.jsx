import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiTruck, FiPlus, FiImage, FiPhone, FiMapPin, FiCheck, FiX, FiTrash2, FiRotateCcw, FiEdit2 } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import BoutonsContact from '../components/BoutonsContact';
import VisionneusePhotos from '../components/VisionneusePhotos';
import CommandesEnLigne from '../components/CommandesEnLigne';
import { listerLivraisons, creerLivraison, modifierLivraison, changerStatutLivraison, supprimerLivraison } from '../services/livraisonService';
import { useAuth } from '../context/AuthContext';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF, aujourdhui } from '../utils/format';
import { compresserImage } from '../utils/images';

const STATUTS = {
  en_cours: { label: 'À livrer', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  livree: { label: 'Livrée', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  annulee: { label: 'Annulée', classe: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

// Mêmes moyens de paiement que la caisse (page Ventes)
const MOYENS_PAIEMENT = [
  { id: 3, nom: 'Cash' },
  { id: 1, nom: 'Orange Money' },
  { id: 2, nom: 'Paiement Marchand' },
];

const ligneVide = () => ({ designation: '', taille: '', photo: null, image: null });
const vide = () => ({ client_nom: '', client_telephone: '', adresse: '', lignes: [ligneVide()], montant_livraison: '', montant_a_encaisser: '', livreur: '', note: '', date_livraison: aujourdhui(), photo: null });

// Photos de la livraison : un clic ouvre l'image en grand (avec la taille de chaque article)
function Miniatures({ l, ouvrir }) {
  const avecPhoto = l.articles.filter((a) => a.image);
  const photos = avecPhoto.map((a) => ({ image: a.image, legende: `${a.designation}${a.taille ? ` — taille ${a.taille}` : ''}` }));
  if (photos.length === 0) return <div className="w-24 h-24 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center"><FiImage className="text-slate-300" size={24} /></div>;
  const montrees = photos.slice(0, 4);
  return (
    <div className={`shrink-0 grid gap-1 ${photos.length === 1 ? 'grid-cols-1 w-24' : 'grid-cols-2 w-24'}`}>
      {montrees.map((p, k) => (
        <button key={k} type="button" onClick={() => ouvrir(photos, k)} className={`relative rounded-lg bg-slate-100 overflow-hidden ${photos.length === 1 ? 'h-24' : 'h-11'}`} title="Voir la photo">
          <img loading="lazy" decoding="async" src={urlFichier(p.image, 300)} alt={p.legende} className="w-full h-full object-cover" />
          {k === 3 && photos.length > 4 && <span className="absolute inset-0 bg-black/55 text-white text-xs font-semibold flex items-center justify-center">+{photos.length - 3}</span>}
        </button>
      ))}
    </div>
  );
}

export default function Livraisons() {
  const { estAdmin } = useAuth();
  const [jour, setJour] = useState(aujourdhui());
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState(null); // livraison en cours de modification
  const [f, setF] = useState(vide());
  const [enregistrement, setEnregistrement] = useState(false);
  const [annulation, setAnnulation] = useState(null); // { livraison, motif }
  const [encaissement, setEncaissement] = useState(null); // { livraison, moyen } : commande en ligne livrée → vente
  const [visionneuse, setVisionneuse] = useState(null); // { photos, depart }

  const charger = useCallback(() => {
    listerLivraisons(jour).then(setListe).catch(() => toast.error('Impossible de charger les livraisons.')).finally(() => setChargement(false));
  }, [jour]);
  useEffect(() => { setChargement(true); charger(); }, [charger]);

  const ouvrirNouvelle = () => { setEdition(null); setF({ ...vide(), date_livraison: jour }); setModal(true); };
  const ouvrirEdition = (l) => {
    setEdition(l);
    setF({ client_nom: l.client_nom, client_telephone: l.client_telephone || '', adresse: l.adresse || '',
      lignes: (l.articles || []).map((a) => ({ designation: a.designation, taille: a.taille || '', photo: null, image: a.image || null })),
      montant_livraison: Number(l.montant_livraison) || '', montant_a_encaisser: Number(l.montant_a_encaisser) || '', livreur: l.livreur || '', note: l.note || '',
      date_livraison: String(l.date_livraison).slice(0, 10), photo: null });
    setModal(true);
  };

  // Plusieurs photos d'un coup : chaque photo devient un article (on ajoute ensuite la taille de chacun)
  const ajouterPhotos = (fichiers) => {
    const nouvelles = Array.from(fichiers || []).map((photo) => ({ ...ligneVide(), photo }));
    if (nouvelles.length === 0) return;
    setF((cur) => {
      const garde = cur.lignes.filter((l) => l.designation || l.taille || l.photo || l.image); // retire les lignes vides
      return { ...cur, lignes: [...garde, ...nouvelles] };
    });
  };

  const majLigne = (i, patch) => setF((cur) => ({ ...cur, lignes: cur.lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));

  const soumettre = async (e) => {
    e.preventDefault();
    setEnregistrement(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => { if (k !== 'lignes') fd.append(k, v ?? ''); });
      fd.append('articles', JSON.stringify(f.lignes.map((l) => ({ designation: l.designation, taille: l.taille, image: l.photo ? null : l.image }))));
      const photos = await Promise.all(f.lignes.map((l) => (l.photo ? compresserImage(l.photo) : null)));
      photos.forEach((ph, i) => { if (ph) fd.append(`image_${i}`, ph); });
      if (edition) await modifierLivraison(edition.id, fd); else await creerLivraison(fd);
      toast.success(edition ? 'Livraison modifiée.' : 'Livraison ajoutée.');
      setModal(false);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally { setEnregistrement(false); }
  };

  const valider = async (l, statut, motif, moyen) => {
    if (statut !== 'livree' && l.statut === 'livree' && l.commande_en_ligne?.vente_id
      && !window.confirm(`La vente ${l.commande_en_ligne.numero_recu} sera supprimée et le stock remis. Continuer ?`)) return;
    try {
      const maj = await changerStatutLivraison(l.id, statut, motif, moyen);
      const recu = maj?.commande_en_ligne?.numero_recu;
      toast.success(statut === 'livree' ? (recu ? `Livraison validée ✅ — vente ${recu} enregistrée` : 'Livraison validée ✅') : statut === 'annulee' ? 'Livraison annulée.' : 'Remise à livrer.');
      setAnnulation(null);
      setEncaissement(null);
      charger();
    } catch (err) { toast.error(err.response?.data?.message || 'Action impossible.'); }
  };

  const supprimer = async (l) => {
    if (!window.confirm(`Supprimer la livraison ${l.numero} ?`)) return;
    try { await supprimerLivraison(l.id); toast.success('Livraison supprimée.'); charger(); } catch (err) { toast.error(err.response?.data?.message || 'Suppression impossible.'); }
  };

  const aLivrer = liste.filter((l) => l.statut === 'en_cours');
  const livrees = liste.filter((l) => l.statut === 'livree');
  const annulees = liste.filter((l) => l.statut === 'annulee');
  const fraisLivres = livrees.reduce((a, l) => a + Number(l.montant_livraison), 0);
  const aEncaisser = aLivrer.reduce((a, l) => a + Number(l.montant_a_encaisser), 0);
  const retard = (l) => l.statut === 'en_cours' && String(l.date_livraison).slice(0, 10) < jour;

  return (
    <div>
      <EnTete titre="Livraisons du jour" sousTitre="Les commandes à livrer : validez-les quand elles sont livrées ou annulées" icone={<FiTruck />}>
        <input type="date" value={jour} onChange={(e) => setJour(e.target.value || aujourdhui())} className="input-champ !w-auto" />
        <button onClick={ouvrirNouvelle} className="btn-primary"><FiPlus /> Nouvelle livraison</button>
      </EnTete>

      {/* Commandes passées depuis l'application Koloun Boutique : à accepter ou refuser */}
      <CommandesEnLigne jour={jour} onAccepte={charger} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[['À livrer', aLivrer.length, 'text-amber-600'], ['Livrées', livrees.length, 'text-emerald-600'], ['Annulées', annulees.length, 'text-slate-500'], ['Frais de livraison (livrées)', formaterGNF(fraisLivres), 'text-blue-700']].map(([t, v, c]) => (
          <div key={t} className="card !p-4"><p className="text-xs text-slate-500">{t}</p><p className={`text-xl font-bold mt-1 ${c}`}>{v}</p></div>
        ))}
      </div>
      {aEncaisser > 0 && <p className="text-sm text-slate-600 mb-4">Montant à encaisser auprès des clients : <b className="text-red-600">{formaterGNF(aEncaisser)}</b></p>}

      {chargement ? <p className="text-slate-400">Chargement…</p> : liste.length === 0 ? (
        <div className="card text-center text-slate-400 py-10">Aucune livraison pour ce jour.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {liste.map((l) => (
            <div key={l.id} className={`card ${l.statut !== 'en_cours' ? 'opacity-90' : ''}`}>
              <div className="flex gap-3">
                <Miniatures l={l} ouvrir={(photos, depart) => setVisionneuse({ photos, depart })} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-slate-400">{l.numero}</p>
                      <p className="font-semibold text-slate-900">{l.articles.length > 1 ? `${l.articles.length} articles` : l.articles[0].designation}</p>
                      {l.articles.length > 1 ? (
                        <ul className="text-xs text-slate-600 mt-0.5">{l.articles.map((a) => <li key={a.id}>• {a.designation}{a.taille ? ` — taille ${a.taille}` : ''}</li>)}</ul>
                      ) : l.articles[0].taille && <p className="text-xs text-slate-600">Taille {l.articles[0].taille}</p>}
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 shrink-0 ${STATUTS[l.statut].classe}`}>{STATUTS[l.statut].label}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{l.client_nom}{l.client_telephone ? ` · ${l.client_telephone}` : ''}</p>
                  {l.adresse && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><FiMapPin size={12} /> {l.adresse}</p>}
                  {l.livreur && <p className="text-xs text-slate-500 mt-0.5">Livreur : {l.livreur}</p>}
                  {l.commande_en_ligne && (
                    <p className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-md px-2 py-0.5 mt-1 w-fit">
                      Boutique en ligne · <span className="whitespace-nowrap">{l.commande_en_ligne.reference}</span>
                      {l.commande_en_ligne.numero_recu && <> · <span className="whitespace-nowrap">vente {l.commande_en_ligne.numero_recu}</span></>}
                    </p>
                  )}
                  {retard(l) && <p className="text-xs text-red-600 font-medium mt-1">En retard — prévue le {new Date(l.date_livraison).toLocaleDateString('fr-FR')}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">Frais de livraison</p><p className="font-semibold text-slate-900">{formaterGNF(l.montant_livraison)}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">À encaisser</p><p className={`font-semibold ${Number(l.montant_a_encaisser) > 0 ? 'text-red-600' : 'text-slate-900'}`}>{formaterGNF(l.montant_a_encaisser)}</p></div>
              </div>
              {l.note && <p className="text-xs text-slate-500 mt-2">📝 {l.note}</p>}
              {l.statut === 'annulee' && l.motif && <p className="text-xs text-red-600 mt-2">Motif : {l.motif}</p>}
              {l.statut !== 'en_cours' && l.validateur && <p className="text-[11px] text-slate-400 mt-2">Validée par {l.validateur.nom} le {new Date(l.date_validation).toLocaleString('fr-FR')}</p>}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {l.statut === 'en_cours' ? (
                  <>
                    <button onClick={() => (l.commande_en_ligne ? setEncaissement({ livraison: l, moyen: 3 }) : valider(l, 'livree'))} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2"><FiCheck /> Livrée</button>
                    <button onClick={() => setAnnulation({ livraison: l, motif: '' })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl px-4 py-2"><FiX /> Annulée</button>
                    <button onClick={() => ouvrirEdition(l)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-2"><FiEdit2 size={13} /> Modifier</button>
                  </>
                ) : estAdmin && (
                  <button onClick={() => valider(l, 'en_cours')} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-2"><FiRotateCcw size={13} /> Remettre à livrer</button>
                )}
                {l.client_telephone && (
                  <BoutonsContact telephone={l.client_telephone} message={`Bonjour ${l.client_nom}, nous sommes en route pour votre livraison « ${l.article} » (Koloun Luxure).`} />
                )}
                {estAdmin && <button onClick={() => supprimer(l)} className="ml-auto text-slate-400 hover:text-red-500" title="Supprimer"><FiTrash2 size={16} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal titre={edition ? `Modifier ${edition.numero}` : 'Nouvelle livraison'} onClose={() => setModal(false)}>
          <form onSubmit={soumettre} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="etiquette">Nom du client (facultatif)</label><input className="input-champ" value={f.client_nom} onChange={(e) => setF({ ...f, client_nom: e.target.value })} /></div>
              <div><label className="etiquette">Téléphone</label><input className="input-champ" inputMode="tel" value={f.client_telephone} onChange={(e) => setF({ ...f, client_telephone: e.target.value })} /></div>
            </div>
            <div><label className="etiquette">Adresse / quartier</label><input className="input-champ" placeholder="Ex : Kipé, près de la station" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></div>
            <div>
              <label className="etiquette">Articles à livrer (nom, taille et photo facultatifs)</label>
              <label className="btn-secondary !py-2 text-sm cursor-pointer mb-3 inline-flex items-center gap-2"><FiImage /> Ajouter des photos (plusieurs d'un coup)
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { ajouterPhotos(e.target.files); e.target.value = ''; }} />
              </label>
              <div className="space-y-3">
                {f.lignes.map((l, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input-champ col-span-2" placeholder="Article (facultatif)" value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })} />
                      <input className="input-champ" placeholder="Taille (facultatif)" value={l.taille} onChange={(e) => majLigne(i, { taille: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {(l.photo || l.image) && <img alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" src={l.photo ? URL.createObjectURL(l.photo) : urlFichier(l.image, 150)} />}
                      <label className="btn-secondary !py-2 text-xs cursor-pointer"><FiImage /> {l.photo || l.image ? 'Changer la photo' : 'Ajouter une photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => majLigne(i, { photo: e.target.files[0] || null })} />
                      </label>
                      {f.lignes.length > 1 && <button type="button" onClick={() => setF({ ...f, lignes: f.lignes.filter((_, k) => k !== i) })} className="ml-auto text-slate-400 hover:text-red-500" title="Retirer cet article"><FiTrash2 size={16} /></button>}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setF({ ...f, lignes: [...f.lignes, ligneVide()] })} className="mt-2 text-sm font-medium text-blue-700 hover:underline inline-flex items-center gap-1"><FiPlus size={14} /> Ajouter un autre article</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="etiquette">Montant de la livraison (frais)</label><input type="number" min="0" className="input-champ" value={f.montant_livraison} onChange={(e) => setF({ ...f, montant_livraison: e.target.value })} /></div>
              <div><label className="etiquette">Montant à encaisser (facultatif)</label><input type="number" min="0" className="input-champ" placeholder="Prix de l'article si payé à la livraison" value={f.montant_a_encaisser} onChange={(e) => setF({ ...f, montant_a_encaisser: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="etiquette">Livreur (facultatif)</label><input className="input-champ" value={f.livreur} onChange={(e) => setF({ ...f, livreur: e.target.value })} /></div>
              <div><label className="etiquette">Date de livraison</label><input type="date" className="input-champ" value={f.date_livraison} onChange={(e) => setF({ ...f, date_livraison: e.target.value })} /></div>
            </div>
            <div><label className="etiquette">Note (facultatif)</label><input className="input-champ" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Fermer</button>
              <button type="submit" disabled={enregistrement} className="btn-primary">{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {visionneuse && <VisionneusePhotos photos={visionneuse.photos} depart={visionneuse.depart} onClose={() => setVisionneuse(null)} />}

      {encaissement && (
        <Modal titre={`Livraison ${encaissement.livraison.numero} effectuée`} onClose={() => setEncaissement(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">C'est une commande de la boutique en ligne ({encaissement.livraison.commande_en_ligne.reference}) : la vente est enregistrée automatiquement et le stock mis à jour.</p>
            <div>
              <label className="etiquette">Comment le client a-t-il payé ?</label>
              <div className="grid grid-cols-3 gap-2">
                {MOYENS_PAIEMENT.map((m) => (
                  <button key={m.id} type="button" onClick={() => setEncaissement({ ...encaissement, moyen: m.id })}
                    className={`h-11 rounded-xl text-sm font-semibold ring-1 ${encaissement.moyen === m.id ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}>{m.nom}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1 tabular-nums">
              <p className="flex justify-between"><span>Vente (articles)</span><b>{formaterGNF(encaissement.livraison.commande_en_ligne.montant_articles)}</b></p>
              <p className="flex justify-between text-slate-500"><span>Frais de livraison (restent dans Livraisons)</span><span>{formaterGNF(encaissement.livraison.montant_livraison)}</span></p>
              <p className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200"><span>Encaissé auprès du client</span><span>{formaterGNF(encaissement.livraison.montant_a_encaisser)}</span></p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEncaissement(null)} className="btn-secondary">Retour</button>
              <button onClick={() => valider(encaissement.livraison, 'livree', undefined, encaissement.moyen)} className="btn-primary !bg-none !bg-emerald-600 hover:!bg-emerald-700"><FiCheck /> Valider la livraison et la vente</button>
            </div>
          </div>
        </Modal>
      )}

      {annulation && (
        <Modal titre={`Annuler ${annulation.livraison.numero}`} onClose={() => setAnnulation(null)}>
          <div className="space-y-4">
            <div><label className="etiquette">Pourquoi cette livraison est-elle annulée ?</label>
              <input autoFocus className="input-champ" placeholder="Ex : client injoignable, adresse introuvable…" value={annulation.motif} onChange={(e) => setAnnulation({ ...annulation, motif: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAnnulation(null)} className="btn-secondary">Retour</button>
              <button disabled={!annulation.motif.trim()} onClick={() => valider(annulation.livraison, 'annulee', annulation.motif)} className="btn-primary !bg-red-600 disabled:opacity-50">Confirmer l'annulation</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
