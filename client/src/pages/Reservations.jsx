import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiBookmark, FiGlobe, FiPlus, FiMinus, FiSearch, FiX, FiCheck, FiPrinter, FiPhone, FiCalendar, FiImage, FiTrash2 } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import EnTete from '../components/EnTete';
import Modal from '../components/Modal';
import ChampClient from '../components/ChampClient';
import { listerProduits } from '../services/produitService';
import { listerClients } from '../services/clientService';
import { genererRecu } from '../services/venteService';
import { listerReservations, creerReservation, retirerReservation, annulerReservation, confirmerReservation, prolongerReservation } from '../services/reservationService';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF, formaterDate, lienWhatsApp, lienAppel, aujourdhui } from '../utils/format';

// Mêmes moyens de paiement que la caisse (page Ventes)
const MOYENS_PAIEMENT = [
  { id: 3, nom: 'Cash' },
  { id: 1, nom: 'Orange Money' },
  { id: 2, nom: 'Paiement Marchand' },
];

const FILTRES = [
  { cle: 'a_confirmer', libelle: 'À confirmer' },
  { cle: 'en_attente', libelle: 'Mises de côté' },
  { cle: 'retiree', libelle: 'Retirées' },
  { cle: 'annulee', libelle: 'Annulées' },
  { cle: 'toutes', libelle: 'Toutes' },
];

const STATUTS = {
  a_confirmer: { libelle: 'À confirmer', classe: 'bg-blue-50 text-blue-700 ring-blue-200' },
  en_attente: { libelle: 'Mise de côté', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  retiree: { libelle: 'Retirée', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  annulee: { libelle: 'Annulée', classe: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

const enRetard = (r) => r.statut === 'en_attente' && r.date_retrait_prevue && String(r.date_retrait_prevue).slice(0, 10) < aujourdhui();

// Ouvre le reçu d'une vente (l'onglet est ouvert au clic, sinon le téléphone le bloque)
async function ouvrirRecu(venteId, onglet) {
  try {
    const res = await genererRecu(venteId);
    if (onglet) onglet.location.href = urlFichier(res.chemin);
  } catch {
    toast.error('Impossible de générer le reçu.');
    onglet?.close();
  }
}

// Bon de réservation envoyé au client par WhatsApp (après confirmation)
const telLisible = (t) => String(t || '').replace(/^224(?=\d{9}$)/, '');
export function messageReservation(r) {
  const lignes = r.articles.map((a) => `• ${a.produit_nom} · taille ${a.taille} × ${a.quantite} : ${formaterGNF(a.prix * a.quantite)}`).join('\n');
  return `Bonjour ${r.client_nom} 👋\n\n✅ Votre réservation *${r.numero}* chez Koloun Luxure est confirmée : vos articles sont mis de côté.\n\n${lignes}\n\n*Total à régler au retrait : ${formaterGNF(r.total)}*${r.date_retrait_prevue ? `\nPassage prévu le ${formaterDate(r.date_retrait_prevue)}` : ''}\n\n📍 Boutique Koloun Luxure, Lambanyi (Forage Dadis), Conakry.\nVous recevrez votre reçu de vente au moment du paiement. À bientôt !`;
}

// Date limite de retrait (annulation automatique après)
const heuresRestantes = (r) => (r.date_expiration ? (new Date(r.date_expiration) - Date.now()) / 3600000 : null);
const dateLimite = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export function messageRappel(r) {
  return `Bonjour ${r.client_nom} 👋\n\nPetit rappel de Koloun Luxure : vos articles réservés (*${r.numero}*, ${formaterGNF(r.total)}) vous attendent à la boutique de Lambanyi jusqu'au *${dateLimite(r.date_expiration)}*.\n\nPassé ce délai, ils seront remis en vente. Un empêchement ? Répondez-nous, on peut vous laisser quelques jours de plus.`;
}

async function envoyerRecuWhatsApp(venteId) {
  const onglet = window.open('', '_blank');
  try {
    const res = await genererRecu(venteId);
    const message = `Bonjour, voici votre reçu ${res.numero_recu} de Koloun Luxure (${formaterGNF(res.montant_total)}) : ${res.lien_public}\nMerci de votre confiance !`;
    const lien = lienWhatsApp(res.client_telephone, message);
    if (onglet) onglet.location.href = lien; else window.location.href = lien;
  } catch {
    toast.error("Impossible de préparer l'envoi WhatsApp.");
    onglet?.close();
  }
}

export default function Reservations() {
  const [filtre, setFiltre] = useState('a_confirmer');
  const [aConfirmer, setAConfirmer] = useState(0);
  const [confirmee, setConfirmee] = useState(null);   // réservation tout juste confirmée → envoi WhatsApp
  const [refus, setRefus] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [creation, setCreation] = useState(false);
  const [retrait, setRetrait] = useState(null);     // réservation à encaisser
  const [annulation, setAnnulation] = useState(null); // { reservation, motif }

  const charger = () => {
    listerReservations({ statut: 'a_confirmer' }).then((l) => setAConfirmer(l.length)).catch(() => {});
    listerReservations({ statut: filtre, q: recherche.trim() || undefined })
      .then((l) => {
        setListe(l);
        // Rien à confirmer à l'ouverture : on montre directement les articles mis de côté
        if (filtre === 'a_confirmer' && !l.length && !recherche && premierChargement.current) setFiltre('en_attente');
        premierChargement.current = false;
      }).catch(() => toast.error('Impossible de charger les réservations.'))
      .finally(() => setChargement(false));
  };
  useEffect(() => {
    const minuteur = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(minuteur);
  }, [filtre, recherche]);

  const premierChargement = React.useRef(true);

  const confirmer = async (r) => {
    try {
      const maj = await confirmerReservation(r.id);
      toast.success(`Réservation ${maj.numero} confirmée : articles mis de côté, stock mis à jour.`);
      setConfirmee(maj);
      charger();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Impossible de confirmer.');
    }
  };

  const totalEnAttente = filtre === 'en_attente' ? liste.reduce((s, r) => s + r.total, 0) : null;

  const annuler = async () => {
    try {
      await annulerReservation(annulation.reservation.id, annulation.motif);
      toast.success(annulation.reservation.statut === 'a_confirmer' ? 'Réservation refusée.' : 'Réservation annulée : les articles sont remis en vente.');
      setAnnulation(null);
      charger();
    } catch (e) {
      toast.error(e.response?.data?.message || "Impossible d'annuler.");
    }
  };

  return (
    <div>
      <EnTete titre="Réservations" icone={<FiBookmark />}
        sousTitre="Articles mis de côté pour un client. Il paie et reçoit son reçu le jour où il passe les chercher.">
        <button onClick={() => setCreation(true)} className="btn-primary"><FiPlus /> Nouvelle réservation</button>
      </EnTete>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-sm">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-champ !pl-10" placeholder="Client, téléphone, article ou numéro…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button key={f.cle} onClick={() => setFiltre(f.cle)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium ring-1 ${filtre === f.cle ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
              {f.libelle}
              {f.cle === 'a_confirmer' && aConfirmer > 0 && <span className={`ml-1.5 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full text-[11px] font-bold ${filtre === f.cle ? 'bg-white text-blue-700' : 'bg-red-500 text-white'}`}>{aConfirmer}</span>}
            </button>
          ))}
        </div>
      </div>

      {totalEnAttente !== null && liste.length > 0 && (
        <p className="text-sm text-slate-600 mb-4">{liste.length} réservation{liste.length > 1 ? 's' : ''} en attente · <b className="text-slate-900">{formaterGNF(totalEnAttente)}</b> à encaisser au retrait</p>
      )}

      {chargement ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : liste.length === 0 ? (
        <div className="card text-center py-12">
          <FiBookmark className="mx-auto text-slate-300" size={28} />
          <p className="text-slate-500 mt-2">{filtre === 'en_attente' ? 'Aucun article réservé pour le moment.' : filtre === 'a_confirmer' ? 'Aucune réservation en ligne à confirmer. Celles des clients de Koloun Boutique arrivent ici.' : 'Aucune réservation ici.'}</p>
          {filtre === 'en_attente' && <button onClick={() => setCreation(true)} className="btn-secondary mt-4"><FiPlus /> Réserver des articles pour un client</button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liste.map((r) => <CarteReservation key={r.id} r={r} onRetirer={() => setRetrait(r)} onConfirmer={() => confirmer(r)} onProlonger={async (j) => { await prolongerReservation(r.id, j); charger(); }} onAnnuler={() => setAnnulation({ reservation: r, motif: '' })} />)}
        </div>
      )}

      {creation && <NouvelleReservation onClose={() => setCreation(false)} onCree={(r) => { setCreation(false); setFiltre('en_attente'); setRecherche(''); toast.success(`Réservation ${r.numero} enregistrée : articles mis de côté.`); charger(); }} />}
      {retrait && <Retrait reservation={retrait} onClose={() => setRetrait(null)} onFait={() => { setRetrait(null); charger(); }} />}

      {annulation && (
        <Modal titre={`${annulation.reservation.statut === 'a_confirmer' ? 'Refuser' : 'Annuler'} ${annulation.reservation.numero}`} onClose={() => setAnnulation(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{annulation.reservation.statut === 'a_confirmer'
              ? `${annulation.reservation.client_nom} verra la réservation « Annulée » dans son compte, avec le motif. Le stock n'avait pas été touché.`
              : `Les articles de ${annulation.reservation.client_nom} seront remis en vente.`}</p>
            <div>
              <label className="etiquette">Motif (facultatif)</label>
              <input autoFocus className="input-champ" placeholder="Ex : le client a changé d'avis" value={annulation.motif} onChange={(e) => setAnnulation({ ...annulation, motif: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAnnulation(null)} className="btn-secondary">Retour</button>
              <button onClick={annuler} className="btn-primary !bg-none !bg-red-600 hover:!bg-red-700">{annulation.reservation.statut === 'a_confirmer' ? 'Refuser la réservation' : 'Annuler la réservation'}</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmee && (
        <Modal titre={`${confirmee.numero} confirmée`} onClose={() => setConfirmee(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Les articles sont mis de côté et retirés du stock. Prévenez {confirmee.client_nom} :</p>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed bg-emerald-50/60 ring-1 ring-emerald-100 rounded-xl p-3 font-sans text-slate-800 max-h-60 overflow-auto">{messageReservation(confirmee)}</pre>
            <div className="flex flex-col sm:flex-row gap-2">
              {confirmee.client_telephone && (
                <a href={lienWhatsApp(confirmee.client_telephone, messageReservation(confirmee))} target="_blank" rel="noreferrer" onClick={() => setConfirmee(null)}
                  className="btn-primary flex-1 !bg-none !bg-emerald-600 hover:!bg-emerald-700"><FaWhatsapp size={17} /> Envoyer par WhatsApp</a>
              )}
              {confirmee.client_telephone && <a href={lienAppel(confirmee.client_telephone)} className="btn-secondary flex-1"><FiPhone /> Appeler {telLisible(confirmee.client_telephone)}</a>}
              <button onClick={() => setConfirmee(null)} className="btn-secondary">Plus tard</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CarteReservation({ r, onRetirer, onConfirmer, onAnnuler, onProlonger }) {
  const [envoi, setEnvoi] = useState(false);
  const s = STATUTS[r.statut];
  return (
    <div className={`card flex flex-col !p-4 ${r.statut === 'annulee' ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{r.client_nom}</p>
          <p className="text-xs text-slate-500">{r.numero}{r.client_telephone && <> · <span className="whitespace-nowrap">{r.client_telephone}</span></>}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`badge ${s.classe}`}>{s.libelle}</span>
          {r.source === 'boutique' && <span className="badge bg-violet-50 text-violet-700 ring-violet-200 whitespace-nowrap"><FiGlobe size={11} className="mr-1" />En ligne</span>}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {r.articles.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
              {a.image ? <img src={urlFichier(a.image)} alt="" loading="lazy" className="w-full h-full object-cover" /> : <FiImage className="text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800 truncate">{a.produit_nom}</p>
              <p className="text-xs text-slate-500">Taille {a.taille} · Qté {a.quantite}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-slate-900 whitespace-nowrap">{formaterGNF(a.prix * a.quantite)}</p>
              {a.prix < a.prix_normal && <p className="text-[11px] text-slate-400 line-through whitespace-nowrap">{formaterGNF(a.prix_normal * a.quantite)}</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-sm text-slate-500">{r.statut === 'retiree' ? 'Payé' : r.statut === 'annulee' ? 'Montant' : 'À payer au retrait'}</span>
        <span className="text-lg font-bold text-slate-900 whitespace-nowrap">{formaterGNF(r.total)}</span>
      </div>

      <div className="text-xs text-slate-500 mt-2 space-y-0.5">
        {r.date_retrait_prevue && ['a_confirmer', 'en_attente'].includes(r.statut) && (
          <p className={`flex items-center gap-1 ${enRetard(r) ? 'text-red-600 font-medium' : ''}`}>
            <FiCalendar size={12} /> {enRetard(r) ? 'Devait passer le' : 'Passe le'} {formaterDate(r.date_retrait_prevue)}
          </p>
        )}
        {r.note && <p>Note : {r.note}</p>}
        <p>Réservé le {formaterDate(r.created_at)}{r.source === 'boutique' ? ' depuis Koloun Boutique' : r.cree_par_nom ? ` par ${r.cree_par_nom}` : ''}</p>
        {r.statut === 'en_attente' && r.date_expiration && (
          <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${heuresRestantes(r) < 24 ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
            <span>⏳ À venir chercher avant le {dateLimite(r.date_expiration)}{heuresRestantes(r) < 24 ? ' : annulée automatiquement après' : ''}</span>
            <button type="button" onClick={async () => { try { await onProlonger(3); toast.success('3 jours de plus accordés.'); } catch (e) { toast.error(e.response?.data?.message || 'Impossible de prolonger.'); } }}
              className="underline text-blue-700 font-medium">+3 jours</button>
          </p>
        )}
        {r.statut === 'a_confirmer' && <p className="text-blue-700">Stock pas encore retiré : confirmez pour mettre les articles de côté.</p>}
        {r.statut === 'retiree' && <p className="text-emerald-700">Retiré le {formaterDate(r.date_traitement)} · reçu {r.numero_recu}</p>}
        {r.statut === 'annulee' && <p>Annulée le {formaterDate(r.date_traitement)}{r.motif ? ` : ${r.motif}` : ''}</p>}
      </div>

      <div className="mt-auto pt-3 space-y-2">
        {r.statut === 'a_confirmer' && (
          <div className="flex gap-2">
            <button disabled={envoi} onClick={async () => { setEnvoi(true); await onConfirmer(); setEnvoi(false); }} className="btn-primary flex-1"><FiCheck /> {envoi ? 'Confirmation…' : 'Confirmer (mettre de côté)'}</button>
            <button onClick={onAnnuler} className="btn-secondary !px-3 text-red-600" title="Refuser la réservation" aria-label="Refuser la réservation"><FiX /></button>
          </div>
        )}
        {r.statut === 'en_attente' && (
          <div className="flex gap-2">
            <button onClick={onRetirer} className="btn-primary flex-1 !bg-none !bg-emerald-600 hover:!bg-emerald-700"><FiCheck /> Client passé : encaisser</button>
            <button onClick={onAnnuler} className="btn-secondary !px-3" title="Annuler la réservation" aria-label="Annuler la réservation"><FiX /></button>
          </div>
        )}
        {r.statut === 'retiree' && r.vente_id && (
          <div className="flex gap-2">
            <button onClick={() => ouvrirRecu(r.vente_id, window.open('', '_blank'))} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5"><FiPrinter size={13} /> Reçu</button>
            <button onClick={() => envoyerRecuWhatsApp(r.vente_id)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5"><FaWhatsapp size={14} /> Reçu par WhatsApp</button>
          </div>
        )}
        {['a_confirmer', 'en_attente'].includes(r.statut) && r.client_telephone && (
          <div className="flex flex-wrap gap-2">
            <a href={lienAppel(r.client_telephone)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5"><FiPhone size={13} /> Appeler</a>
            {r.statut === 'en_attente' && (
              <a href={lienWhatsApp(r.client_telephone, messageReservation(r))} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5"><FaWhatsapp size={14} /> Bon de réservation</a>
            )}
            {r.statut === 'en_attente' && r.date_expiration && (
              <a href={lienWhatsApp(r.client_telephone, messageRappel(r))} target="_blank" rel="noreferrer"
                className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 ${heuresRestantes(r) < 24 ? 'text-white bg-emerald-600 hover:bg-emerald-700' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}><FaWhatsapp size={14} /> Rappel</a>
            )}
            {r.statut === 'a_confirmer' && (
              <a href={lienWhatsApp(r.client_telephone, `Bonjour ${r.client_nom}, Koloun Luxure a bien reçu votre réservation ${r.numero}. `)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5"><FaWhatsapp size={14} /> Écrire</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Nouvelle réservation : choisir le client, puis les articles disponibles et leur taille ----------
function NouvelleReservation({ onClose, onCree }) {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState(null);
  const [client, setClient] = useState({ client_id: '', nom: '', telephone: '' });
  const [choix, setChoix] = useState([]); // { produit_taille_id, nom, taille, image, stock, prix_normal, prix, quantite }
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(null);   // produit dont on choisit la taille
  const [variante, setVariante] = useState(0);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    listerClients().then(setClients).catch(() => {});
    listerProduits().then(setProduits).catch(() => setProduits([]));
  }, []);

  // Seuls les produits qui ont encore au moins une taille en stock
  const disponibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (produits || [])
      .filter((p) => (p.ProduitVariantes || []).some((v) => (v.ProduitTailles || []).some((t) => t.quantite > 0)))
      .filter((p) => !q || p.nom.toLowerCase().includes(q));
  }, [produits, recherche]);

  const dejaPris = (id) => choix.find((c) => c.produit_taille_id === id)?.quantite || 0;

  const ajouter = (p, v, t) => {
    if (dejaPris(t.id) >= t.quantite) return toast.warn(`Plus de stock pour la taille ${t.taille}.`);
    if (choix.some((c) => c.produit_taille_id === t.id)) {
      setChoix(choix.map((c) => (c.produit_taille_id === t.id ? { ...c, quantite: c.quantite + 1 } : c)));
    } else {
      setChoix([...choix, { produit_taille_id: t.id, nom: p.nom, taille: t.taille, image: v.image, stock: t.quantite, prix_normal: Number(p.prix_normal), prix: Number(p.prix_normal), quantite: 1 }]);
    }
    toast.success(`${p.nom} · taille ${t.taille} ajouté`, { autoClose: 1200 });
  };
  const changer = (id, champ, valeur) => setChoix(choix.map((c) => (c.produit_taille_id === id ? { ...c, [champ]: valeur } : c)));
  const quantite = (c, delta) => {
    const q = c.quantite + delta;
    if (q < 1) return setChoix(choix.filter((x) => x.produit_taille_id !== c.produit_taille_id));
    if (q > c.stock) return toast.warn(`Seulement ${c.stock} en stock pour cette taille.`);
    changer(c.produit_taille_id, 'quantite', q);
  };

  const total = choix.reduce((s, c) => s + (Number(c.prix) || 0) * c.quantite, 0);

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!choix.length) return toast.warn('Choisissez au moins un article.');
    if (!client.client_id && !client.nom.trim()) return toast.warn('Indiquez le nom du client.');
    setEnvoi(true);
    try {
      const r = await creerReservation({
        client_id: client.client_id || undefined, client_nom: client.nom, client_telephone: client.telephone,
        date_retrait_prevue: date || undefined, note,
        articles: choix.map((c) => ({ produit_taille_id: c.produit_taille_id, quantite: c.quantite, prix: c.prix === '' ? undefined : Number(c.prix) })),
      });
      onCree(r);
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible d'enregistrer la réservation.");
      setEnvoi(false);
    }
  };

  const p = ouvert && produits?.find((x) => x.id === ouvert);
  const v = p?.ProduitVariantes?.[variante];

  return (
    <Modal titre="Nouvelle réservation" onClose={onClose} large>
      <form onSubmit={enregistrer} className="space-y-5">
        <ChampClient clients={clients} valeur={client} onChange={setClient} />

        <div>
          <p className="etiquette">Articles réservés</p>
          {choix.length === 0 ? (
            <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-3 py-3">Choisissez les articles dans la liste ci-dessous.</p>
          ) : (
            <ul className="space-y-2">
              {choix.map((c) => (
                <li key={c.produit_taille_id} className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-xl p-2.5">
                  <img src={urlFichier(c.image)} alt="" className="w-11 h-11 rounded-lg object-cover bg-white shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.nom}</p>
                    <p className="text-xs text-slate-500">Taille {c.taille} · {c.stock} en stock</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => quantite(c, -1)} className="w-8 h-8 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center" aria-label="Retirer un">{c.quantite === 1 ? <FiTrash2 size={14} /> : <FiMinus size={14} />}</button>
                    <span className="w-7 text-center text-sm font-semibold">{c.quantite}</span>
                    <button type="button" onClick={() => quantite(c, 1)} className="w-8 h-8 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center" aria-label="Ajouter un"><FiPlus size={14} /></button>
                  </div>
                  <label className="w-full sm:w-40 flex items-center gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">Prix accordé</span>
                    <input type="number" min="0" inputMode="numeric" className="input-champ !py-2 text-right" value={c.prix}
                      onChange={(e) => changer(c.produit_taille_id, 'prix', e.target.value)} title="Prix accordé (par article)" />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 relative">
            <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-champ !pl-10" placeholder="Chercher un article disponible…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {produits === null && <p className="text-sm text-slate-400 p-4">Chargement des articles…</p>}
            {produits && disponibles.length === 0 && <p className="text-sm text-slate-400 p-4">Aucun article disponible{recherche ? ' pour cette recherche' : ''}.</p>}
            {disponibles.map((prod) => {
              const actif = ouvert === prod.id;
              return (
                <div key={prod.id}>
                  <button type="button" onClick={() => { setOuvert(actif ? null : prod.id); setVariante(0); }}
                    className={`w-full flex items-center gap-3 p-2.5 text-left ${actif ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <img src={urlFichier(prod.ProduitVariantes[0]?.image)} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 truncate">{prod.nom}</span>
                      <span className="block text-xs text-blue-600">{formaterGNF(prod.prix_normal)}</span>
                    </span>
                    <span className="text-xs font-medium text-blue-700">{actif ? 'Fermer' : 'Choisir la taille'}</span>
                  </button>
                  {actif && v && (
                    <div className="px-3 pb-3 bg-blue-50">
                      {p.ProduitVariantes.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-2">
                          {p.ProduitVariantes.map((x, i) => (
                            <button key={x.id} type="button" onClick={() => setVariante(i)} aria-label={`Photo ${i + 1}`}
                              className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 ring-2 ${i === variante ? 'ring-blue-600' : 'ring-transparent'}`}>
                              <img src={urlFichier(x.image)} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(v.ProduitTailles || []).map((t) => {
                          const reste = t.quantite - dejaPris(t.id);
                          return (
                            <button key={t.id} type="button" disabled={reste <= 0} onClick={() => ajouter(p, v, t)}
                              className="h-10 px-3 rounded-xl bg-white ring-1 ring-slate-200 text-sm font-semibold text-slate-800 hover:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                              {t.taille} <span className="text-xs font-normal text-slate-500">· {reste > 0 ? `${reste} dispo` : 'épuisé'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="etiquette">Passera les chercher le (facultatif)</label>
            <input type="date" min={aujourdhui()} className="input-champ" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="etiquette">Note (facultatif)</label>
            <input className="input-champ" placeholder="Ex : passe après le travail" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">À payer au retrait</p>
            <p className="text-lg font-bold text-slate-900 whitespace-nowrap">{formaterGNF(total)}</p>
          </div>
          <button type="submit" disabled={envoi || !choix.length} className="btn-primary">{envoi ? 'Enregistrement…' : 'Réserver'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Retrait : le client est là, il paie, la vente et le reçu sont enregistrés ----------
function Retrait({ reservation: r, onClose, onFait }) {
  const [moyen, setMoyen] = useState(3);
  const [prix, setPrix] = useState(() => Object.fromEntries(r.articles.map((a) => [a.id, a.prix])));
  const [envoi, setEnvoi] = useState(false);
  const total = r.articles.reduce((s, a) => s + (Number(prix[a.id]) || 0) * a.quantite, 0);

  const encaisser = async (avecRecu) => {
    const onglet = avecRecu ? window.open('', '_blank') : null;
    setEnvoi(true);
    try {
      const maj = await retirerReservation(r.id, moyen, prix);
      toast.success(`Vente ${maj.numero_recu} enregistrée.`);
      if (avecRecu) await ouvrirRecu(maj.vente_id, onglet);
      onFait();
    } catch (e) {
      onglet?.close();
      toast.error(e.response?.data?.message || "Impossible d'enregistrer la vente.");
      setEnvoi(false);
    }
  };

  return (
    <Modal titre={`${r.client_nom} est passé`} onClose={onClose}>
      <div className="space-y-4">
        <ul className="space-y-2">
          {r.articles.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <img src={urlFichier(a.image)} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{a.produit_nom}</p>
                <p className="text-xs text-slate-500">Taille {a.taille} · Qté {a.quantite}</p>
              </div>
              <label className="w-32 shrink-0">
                <span className="sr-only">Prix par article</span>
                <input type="number" min="0" inputMode="numeric" className="input-champ !py-2 text-right" value={prix[a.id]}
                  onChange={(e) => setPrix({ ...prix, [a.id]: e.target.value })} />
              </label>
            </li>
          ))}
        </ul>
        <div>
          <label className="etiquette">Comment le client paie-t-il ?</label>
          <div className="grid grid-cols-3 gap-2">
            {MOYENS_PAIEMENT.map((m) => (
              <button key={m.id} type="button" onClick={() => setMoyen(m.id)}
                className={`h-11 rounded-xl text-sm font-semibold ring-1 ${moyen === m.id ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}>{m.nom}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Total encaissé</span>
          <span className="text-xl font-bold text-slate-900 whitespace-nowrap">{formaterGNF(total)}</span>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button disabled={envoi} onClick={() => encaisser(false)} className="btn-secondary">Encaisser sans imprimer</button>
          <button disabled={envoi} onClick={() => encaisser(true)} className="btn-primary !bg-none !bg-emerald-600 hover:!bg-emerald-700"><FiPrinter /> Encaisser et ouvrir le reçu</button>
        </div>
      </div>
    </Modal>
  );
}
