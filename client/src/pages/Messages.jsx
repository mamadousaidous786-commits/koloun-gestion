import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiImage, FiPhone, FiSearch, FiSend, FiMessageSquare, FiEdit3, FiExternalLink } from 'react-icons/fi';
import api from '../services/api';
import Modal from '../components/Modal';
import { compresserImage } from '../utils/images';
import { formaterGNF, lienAppel } from '../utils/format';

// Discussion avec les clients de Koloun Boutique, comme sur 1688 :
// le client envoie un article, son panier ou sa commande ; vous répondez, envoyez des photos et changez le prix.
const STATUTS_CMD = { nouvelle: 'À confirmer', en_discussion: 'À confirmer', validee: 'Confirmée', livree: 'Livrée', annulee: 'Annulée' };
const STATUTS_RESA = { a_confirmer: 'À confirmer', en_attente: 'Mise de côté', retiree: 'Retirée', annulee: 'Annulée' };
const heure = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const quand = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return x.toDateString() === new Date().toDateString() ? heure(d) : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const telLisible = (t) => String(t || '').replace(/^224(?=\d{9}$)/, '');

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const ouverte = Number(params.get('c')) || null;
  const [liste, setListe] = useState(null);
  const [recherche, setRecherche] = useState('');

  const chargerListe = () => api.get('/chat', { params: { q: recherche.trim() || undefined } }).then((r) => setListe(r.data)).catch(() => setListe((l) => l || []));
  useEffect(() => {
    const m = setTimeout(chargerListe, recherche ? 300 : 0);
    const minuteur = setInterval(() => document.visibilityState === 'visible' && chargerListe(), 30000);
    const surMessage = () => chargerListe();
    window.addEventListener('kl-chat-message', surMessage);
    return () => { clearTimeout(m); clearInterval(minuteur); window.removeEventListener('kl-chat-message', surMessage); };
  }, [recherche]); // eslint-disable-line react-hooks/exhaustive-deps

  const ouvrir = (id) => { const p = new URLSearchParams(params); if (id) p.set('c', id); else p.delete('c'); setParams(p); };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100dvh-56px)] md:h-dvh flex bg-white">
      {/* Liste des conversations */}
      <div className={`${ouverte ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 xl:w-96 border-r border-slate-200 shrink-0`}>
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FiMessageSquare /> Messages clients</h1>
          <div className="relative mt-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-champ !pl-9" placeholder="Nom ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {liste === null ? <li className="p-6 text-center text-slate-400">Chargement…</li> : !liste.length ? (
            <li className="p-6 text-center text-sm text-slate-500">Aucun message pour le moment. Quand un client touche « Discuter » dans Koloun Boutique, sa conversation arrive ici.</li>
          ) : liste.map((c) => (
            <li key={c.id}>
              <button onClick={() => ouvrir(c.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${ouverte === c.id ? 'bg-blue-50' : ''}`}>
                <span className="w-11 h-11 rounded-full bg-marine-800 text-white flex items-center justify-center font-semibold shrink-0 overflow-hidden">
                  {c.photo ? <img src={c.photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : c.nom.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-2"><span className={`truncate ${c.non_lu_vendeur ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{c.nom}</span><span className="text-[11px] text-slate-400 shrink-0">{quand(c.dernier_message_at)}</span></span>
                  <span className="flex justify-between gap-2 mt-0.5">
                    <span className={`text-xs truncate ${c.non_lu_vendeur ? 'text-slate-800' : 'text-slate-500'}`}>{c.dernier_auteur === 'vendeur' ? 'Vous : ' : c.dernier_auteur === 'agent' ? 'Agent : ' : ''}{c.apercu}</span>
                    {c.non_lu_vendeur > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{c.non_lu_vendeur}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Conversation */}
      <div className={`${ouverte ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0 bg-[#efeae2]`}>
        {ouverte ? <Conversation key={ouverte} id={ouverte} onRetour={() => ouvrir(null)} onLu={chargerListe} /> : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Choisissez une conversation.</div>
        )}
      </div>
    </div>
  );
}

function Conversation({ id, onRetour, onLu }) {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [messages, setMessages] = useState(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [prix, setPrix] = useState(null); // commande dont on change le prix
  const dernier = useRef(0);
  const fin = useRef(null);
  const fichier = useRef(null);

  const charger = async (tout = false) => {
    const r = await api.get(`/chat/${id}`, { params: { apres: tout ? undefined : dernier.current || undefined } });
    setClient(r.data.client);
    if (!r.data.messages.length && !tout) return;
    dernier.current = r.data.messages.at(-1)?.id || dernier.current;
    setMessages((avant) => {
      if (tout || !avant) return r.data.messages;
      const base = r.data.messages.some((m) => m.auteur === 'vendeur') ? avant.filter((a) => !a.temporaire) : avant;
      return [...base, ...r.data.messages.filter((m) => !base.some((a) => a.id === m.id))];
    });
    window.dispatchEvent(new Event('kl-messages-lus'));
    onLu?.();
  };

  useEffect(() => {
    charger(true).catch(() => toast.error('Impossible de charger la conversation.'));
    // Direct : le message du client arrive par la connexion ouverte de l'application → affiché aussitôt
    const surMessage = (e) => { if (e.detail?.conversation_id === id) charger().catch(() => {}); };
    window.addEventListener('kl-chat-message', surMessage);
    const secours = setInterval(() => document.visibilityState === 'visible' && charger().catch(() => {}), 15000);
    return () => { clearInterval(secours); window.removeEventListener('kl-chat-message', surMessage); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);
  const zone = useRef(null);
  useEffect(() => { // photos chargées après coup : on reste en bas
    if (!zone.current || typeof ResizeObserver === 'undefined') return undefined;
    const o = new ResizeObserver(() => { const z = zone.current; if (z && z.scrollHeight - z.scrollTop - z.clientHeight < 250) fin.current?.scrollIntoView({ block: 'end' }); });
    o.observe(zone.current.firstElementChild || zone.current);
    return () => o.disconnect();
  }, [messages === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recharge tout (les cartes commande affichent leur prix et leur statut à jour)
  const rafraichir = () => { dernier.current = 0; return charger(true); };

  const envoyer = async (e) => {
    e?.preventDefault();
    const t = texte.trim();
    if (!t) return;
    // Affiché tout de suite ; remplacé par le vrai message dès que le serveur l'a enregistré
    const temp = { id: `t${Date.now()}`, temporaire: true, auteur: 'vendeur', type: 'texte', texte: t, created_at: new Date().toISOString() };
    setMessages((m) => [...(m || []), temp]); setTexte('');
    try { await api.post(`/chat/${id}`, { texte: t }); await charger(); } catch (err) {
      setMessages((m) => (m || []).filter((x) => x.id !== temp.id)); setTexte(t);
      toast.error(err.response?.data?.message || 'Message non envoyé.');
    }
  };
  const envoyerPhoto = async (f) => {
    if (!f) return;
    setEnvoi(true);
    try {
      const fd = new FormData(); fd.append('image', await compresserImage(f));
      await api.post(`/chat/${id}`, fd); await charger();
    } catch (err) { toast.error(err.response?.data?.message || 'Photo non envoyée.'); }
    setEnvoi(false); if (fichier.current) fichier.current.value = '';
  };

  return (
    <>
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200">
        <button onClick={onRetour} className="lg:hidden p-1.5 -ml-1 text-slate-600" aria-label="Retour aux conversations"><FiArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{client?.nom || '…'}</p>
          <p className="text-xs text-slate-500 truncate">{client?.telephone ? telLisible(client.telephone) : client?.email || ''}</p>
        </div>
        {client?.telephone && <a href={lienAppel(client.telephone)} className="btn-secondary !px-3 !py-2" title="Appeler"><FiPhone /> <span className="hidden sm:inline">Appeler</span></a>}
      </div>

      <div ref={zone} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
        <div className="space-y-2">
        {messages === null ? <p className="text-center text-slate-400 text-sm">Chargement…</p> : messages.map((m) => (
          <Bulle key={m.id} m={m} onPrix={(c) => setPrix(c)} onConfirmer={() => navigate('/livraisons')} />
        ))}
        </div>
        <div ref={fin} />
      </div>

      <form onSubmit={envoyer} className="flex items-end gap-2 p-2 sm:p-3 bg-white border-t border-slate-200" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => fichier.current?.click()} disabled={envoi} className="p-2.5 text-slate-500 hover:text-slate-800" aria-label="Envoyer une photo (effacée après 24 h)" title="Photo (effacée après 24 h)"><FiImage size={20} /></button>
        <input ref={fichier} type="file" accept="image/*" hidden onChange={(e) => envoyerPhoto(e.target.files?.[0])} />
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} placeholder="Votre réponse…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) envoyer(e); }}
          className="input-champ flex-1 !rounded-2xl resize-none max-h-32" />
        <button type="submit" disabled={!texte.trim()} className="btn-primary !px-3.5 !py-2.5" aria-label="Envoyer"><FiSend /></button>
      </form>

      {prix && <ModifierPrix commande={prix} onClose={() => setPrix(null)} onFait={() => { setPrix(null); rafraichir(); }} />}
    </>
  );
}

function Bulle({ m, onPrix, onConfirmer }) {
  if (m.auteur === 'systeme') return <p className="mx-auto w-fit max-w-[90%] text-center text-xs bg-white/80 text-slate-600 rounded-lg px-3 py-1.5">{m.texte}</p>;
  const client = m.auteur === 'client';
  const d = m.donnees || {};
  const carte = ['produit', 'panier', 'commande', 'prix', 'reservation'].includes(m.type);
  let contenu;
  if (m.type === 'image' && d.expiree) contenu = <p className="italic text-slate-500 text-sm">📷 Photo effacée (24 h)</p>;
  else if (m.type === 'image') contenu = <><a href={d.url} target="_blank" rel="noreferrer"><img src={d.url} alt="" className="rounded-lg max-h-72 max-w-full" loading="lazy" /></a>{m.texte && <p className="mt-1 whitespace-pre-wrap">{m.texte}</p>}</>;
  else if (m.type === 'produit') contenu = (
    <div className="flex gap-3 items-center">
      {d.image && <img src={d.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
      <div className="min-w-0"><p className="text-[11px] text-slate-500">Article regardé par le client</p><p className="font-medium text-slate-900">{d.nom}</p>{d.taille && <p className="text-xs text-slate-500">Taille {d.taille}</p>}<p className="font-semibold">{formaterGNF(d.prix)}</p></div>
    </div>
  );
  else if (m.type === 'panier') contenu = (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1.5">🛒 Panier du client</p>
      <Lignes lignes={(d.lignes || []).map((l) => ({ ...l, prix_unitaire: l.prix }))} />
      <Total libelle="Total" valeur={d.total} />
    </div>
  );
  else if (m.type === 'commande' || m.type === 'prix') {
    const c = m.commande;
    contenu = !c ? <p className="text-sm text-slate-500">Commande introuvable.</p> : (
      <div>
        <div className="flex justify-between items-center gap-2 mb-1.5">
          <p className="text-xs font-semibold text-slate-600">{m.type === 'prix' ? '💰 Prix modifié' : '📦 Commande'} {c.reference}</p>
          <span className={`badge whitespace-nowrap ${['annulee', 'livree'].includes(c.statut) ? 'bg-slate-100 text-slate-600 ring-slate-200' : c.statut === 'validee' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>{STATUTS_CMD[c.statut] || c.statut}</span>
        </div>
        {m.type === 'prix' ? <p className="text-sm">{formaterGNF(d.ancien)} → <b>{formaterGNF(d.nouveau)}</b></p> : <Lignes lignes={c.lignes} />}
        <Total libelle={c.mode_livraison === 'retrait' ? 'Total (retrait)' : 'Total articles'} valeur={c.total_final} barre={c.total_final < c.total_initial ? c.total_initial : null} />
        {m.type === 'commande' && !['livree', 'annulee'].includes(c.statut) && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button onClick={() => onPrix(c)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-1.5"><FiEdit3 size={13} /> Modifier le prix</button>
            {['nouvelle', 'en_discussion'].includes(c.statut) && <button onClick={onConfirmer} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5"><FiExternalLink size={13} /> Confirmer (Livraisons)</button>}
          </div>
        )}
      </div>
    );
  } else if (m.type === 'reservation') {
    const r = m.reservation;
    contenu = !r ? <p className="text-sm text-slate-500">Réservation introuvable.</p> : (
      <div>
        <div className="flex justify-between items-center gap-2 mb-1.5"><p className="text-xs font-semibold text-slate-600">🔖 Réservation {r.numero}</p><span className="badge bg-blue-50 text-blue-700 ring-blue-200 whitespace-nowrap">{STATUTS_RESA[r.statut]}</span></div>
        <Lignes lignes={r.articles.map((a) => ({ ...a, prix_unitaire: a.prix }))} />
        <Total libelle="À payer au retrait" valeur={r.total} />
        {r.statut === 'a_confirmer' && <a href="/reservations" className="inline-flex mt-2.5 items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5"><FiExternalLink size={13} /> Confirmer (Réservations)</a>}
      </div>
    );
  } else contenu = <p className="whitespace-pre-wrap">{m.texte}</p>;

  return (
    <div className={`flex ${client ? 'justify-start' : 'justify-end'}`}>
      <div className={`relative rounded-2xl px-3 pt-2 pb-5 shadow-sm text-[15px] break-words ${carte ? 'w-[min(320px,85%)]' : 'max-w-[82%]'} ${client ? 'bg-white text-slate-800 rounded-bl-md' : 'bg-[#d9fdd3] text-slate-900 rounded-br-md'}`}>
        {m.auteur === 'agent' && <p className="text-[11px] font-semibold text-violet-700 mb-0.5">Agent IA</p>}
        {contenu}
        <span className="absolute right-2.5 bottom-1 text-[10px] text-slate-400">{m.temporaire ? 'envoi…' : heure(m.created_at)}</span>
      </div>
    </div>
  );
}

const Lignes = ({ lignes }) => (
  <ul className="space-y-1.5">
    {lignes.map((l, i) => (
      <li key={l.id || i} className="flex items-center gap-2 text-sm">
        {l.image ? <img src={l.image} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" /> : <span className="w-9 h-9 rounded-md bg-slate-100 shrink-0" />}
        <span className="flex-1 min-w-0 truncate">{l.nom}{l.taille ? ` · T.${l.taille}` : ''} ×{l.quantite}</span>
        <span className="text-right shrink-0">
          {l.prix_negocie != null && <span className="block text-[11px] text-slate-400 line-through">{formaterGNF(l.prix_unitaire * l.quantite)}</span>}
          <span className="font-medium">{formaterGNF((l.prix_negocie ?? l.prix_unitaire) * l.quantite)}</span>
        </span>
      </li>
    ))}
  </ul>
);
const Total = ({ libelle, valeur, barre }) => (
  <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-slate-200/70 text-sm">
    <span className="text-slate-500">{libelle}</span>
    <span>{barre && <span className="text-xs text-slate-400 line-through mr-1.5">{formaterGNF(barre)}</span>}<b>{formaterGNF(valeur)}</b></span>
  </div>
);

// « Modifier le prix » comme sur 1688 : prix par article et/ou nouveau total. Réduction seulement.
function ModifierPrix({ commande: c, onClose, onFait }) {
  const [prix, setPrix] = useState(() => Object.fromEntries(c.lignes.map((l) => [l.id, String(l.prix_negocie ?? l.prix_unitaire)])));
  const [total, setTotal] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const sousTotal = c.lignes.reduce((s, l) => s + (Number(prix[l.id]) || 0) * l.quantite, 0);
  const remiseActuelle = c.remise || 0;
  const nouveauTotal = total !== '' ? Math.min(Number(total) || 0, sousTotal) : Math.max(0, sousTotal - remiseActuelle);

  const enregistrer = async () => {
    for (const l of c.lignes) {
      const p = Number(prix[l.id]);
      if (!(p >= 0)) return toast.error(`Prix invalide pour « ${l.nom} ».`);
      if (p > l.prix_unitaire) return toast.error(`« ${l.nom} » : le prix ne peut pas dépasser ${formaterGNF(l.prix_unitaire)}.`);
    }
    setEnvoi(true);
    try {
      await api.patch(`/boutique/admin/commandes/${c.id}`, {
        lignes: c.lignes.map((l) => ({ id: l.id, prix_negocie: Number(prix[l.id]) })),
        remise: Math.max(0, sousTotal - nouveauTotal),
      });
      toast.success('Nouveau prix envoyé au client.');
      onFait();
    } catch (e) { toast.error(e.response?.data?.message || "Le prix n'a pas pu être changé."); }
    setEnvoi(false);
  };

  return (
    <Modal titre={`Modifier le prix · ${c.reference}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Le client voit le nouveau prix tout de suite dans la discussion et dans sa commande.{c.statut === 'validee' ? ' La livraison encaissera le nouveau montant.' : ''}</p>
        <ul className="space-y-3">
          {c.lignes.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              {l.image && <img src={l.image} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{l.nom}{l.taille ? ` · T.${l.taille}` : ''} ×{l.quantite}</p>
                <p className="text-xs text-slate-400">Prix affiché {formaterGNF(l.prix_unitaire)}</p>
              </div>
              <input type="number" inputMode="numeric" min="0" step="500" className="input-champ !w-32 text-right" value={prix[l.id]}
                onChange={(e) => { setPrix({ ...prix, [l.id]: e.target.value }); setTotal(''); }} aria-label={`Prix unitaire de ${l.nom}`} />
            </li>
          ))}
        </ul>
        <div>
          <label className="etiquette">Ou un nouveau total (facultatif)</label>
          <input type="number" inputMode="numeric" min="0" step="500" className="input-champ" placeholder={String(Math.max(0, sousTotal - remiseActuelle))} value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="flex justify-between items-baseline bg-slate-50 rounded-xl px-4 py-3">
          <span className="text-sm text-slate-600">Nouveau total</span>
          <span>{nouveauTotal < c.total_initial && <span className="text-xs text-slate-400 line-through mr-2">{formaterGNF(c.total_initial)}</span>}<b className="text-lg">{formaterGNF(nouveauTotal)}</b></span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={envoi} className="btn-primary !bg-none !bg-orange-500 hover:!bg-orange-600">{envoi ? 'Envoi…' : 'Envoyer le nouveau prix'}</button>
        </div>
      </div>
    </Modal>
  );
}
