import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiMessageCircle, FiSend, FiRefreshCw, FiCheck, FiX, FiPhone, FiExternalLink, FiUser, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import EnTete from '../components/EnTete';
import { useAuth } from '../context/AuthContext';
import { etatAgent, parlerAgent, rendreLaMainAgent, demandesAgent, traiterDemandeAgent } from '../services/agentService';
import { formaterGNF, formaterDate, lienWhatsApp, lienAppel } from '../utils/format';

const nouvelleSession = () => Math.random().toString(36).slice(2, 10);
const EXEMPLES = ['Bonjour, vous avez des baskets en 42 ?', 'Envoyez-moi les photos', 'Vous pouvez me faire un prix ?', 'Où en est ma commande KB-… ?'];

// Mise en forme WhatsApp : *gras* et liens cliquables
function TexteAgent({ texte }) {
  const morceaux = String(texte).split(/(\*[^*\n]+\*|https?:\/\/\S+)/g);
  return morceaux.map((m, i) => {
    if (/^\*[^*]+\*$/.test(m)) return <b key={i}>{m.slice(1, -1)}</b>;
    if (/^https?:\/\//.test(m)) return <a key={i} href={m} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{m}</a>;
    return <React.Fragment key={i}>{m}</React.Fragment>;
  });
}

export default function AgentIA() {
  const { estAdmin } = useAuth();
  const [etat, setEtat] = useState(null);
  const [filtre, setFiltre] = useState('nouvelle');
  const [demandes, setDemandes] = useState([]);

  const chargerEtat = () => etatAgent().then(setEtat).catch(() => {});
  const chargerDemandes = () => demandesAgent(filtre).then(setDemandes).catch(() => toast.error('Impossible de charger les commandes transmises.'));
  useEffect(() => { chargerEtat(); }, []);
  useEffect(() => { chargerDemandes(); const t = setInterval(chargerDemandes, 60000); return () => clearInterval(t); }, [filtre]);

  const traiter = async (d, statut) => {
    try { await traiterDemandeAgent(d.id, statut); toast.success(statut === 'traitee' ? 'Marquée comme traitée.' : statut === 'annulee' ? 'Demande annulée.' : 'Remise en attente.'); chargerDemandes(); chargerEtat(); }
    catch { toast.error('Action impossible.'); }
  };

  const pourcent = etat ? Math.min(100, Math.round((etat.depense_mois / Math.max(etat.budget_mois, 0.01)) * 100)) : 0;

  return (
    <div>
      <EnTete titre="Agent IA" icone={<FiMessageCircle />} sousTitre="Le vendeur virtuel qui répond à vos clients et vous transmet leurs commandes." />

      {etat && (
        <div className="card !p-4 mb-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">État</p>
            {etat.actif
              ? <p className="font-semibold text-emerald-700 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Prêt</p>
              : <p className="font-semibold text-amber-700 flex items-center gap-1.5"><FiAlertCircle /> Clé IA à ajouter dans Render</p>}
            <p className="text-xs text-slate-500 mt-0.5">Réduction maximum : {etat.remise_max} %</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Coût IA ce mois-ci</p>
            <p className="font-semibold text-slate-900 tabular-nums">{etat.depense_mois.toFixed(2)} $ <span className="text-slate-400 font-normal">/ {etat.budget_mois} $</span></p>
            <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden"><div className={`h-full ${pourcent >= 90 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${pourcent}%` }} /></div>
            <p className="text-xs text-slate-500 mt-1">{etat.reponses_mois} réponse{etat.reponses_mois > 1 ? 's' : ''} · au plafond, l'agent vous passe la main</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Commandes à traiter</p>
            <p className="font-semibold text-slate-900">{etat.demandes_nouvelles}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {estAdmin && <Essai etat={etat} onApresReponse={() => { chargerEtat(); chargerDemandes(); }} />}

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-900">Commandes transmises par l'agent</h2>
            <div className="flex gap-1.5">
              {[['nouvelle', 'À traiter'], ['traitee', 'Traitées'], ['toutes', 'Toutes']].map(([cle, lib]) => (
                <button key={cle} onClick={() => setFiltre(cle)} className={`h-8 px-3 rounded-full text-xs font-medium ring-1 ${filtre === cle ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200'}`}>{lib}</button>
              ))}
            </div>
          </div>
          {demandes.length === 0 ? (
            <div className="card text-center py-10 text-sm text-slate-500">
              {filtre === 'nouvelle' ? "Aucune commande en attente. Quand un client confirme une commande avec l'agent, elle arrive ici et vous recevez une alerte." : 'Rien ici.'}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {demandes.map((d) => (
                <div key={d.id} className={`card !p-4 ${d.statut !== 'nouvelle' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{d.client_nom}</p>
                      <p className="text-xs text-slate-500">{d.reference} · {d.canal === 'test' ? 'test' : d.canal === 'whatsapp' ? 'WhatsApp' : 'Messenger'} · {formaterDate(d.created_at)}</p>
                    </div>
                    <span className={`badge shrink-0 ${d.statut === 'nouvelle' ? 'bg-amber-50 text-amber-700 ring-amber-200' : d.statut === 'traitee' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                      {d.statut === 'nouvelle' ? 'À traiter' : d.statut === 'traitee' ? 'Traitée' : 'Annulée'}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {d.lignes.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <a href={l.lien} target="_blank" rel="noreferrer" className="min-w-0 text-slate-800 hover:text-blue-700">{l.nom} · T. {l.taille} × {l.quantite} <FiExternalLink className="inline" size={11} /></a>
                        <span className="shrink-0 whitespace-nowrap text-right">
                          {formaterGNF(l.prix * l.quantite)}
                          {l.prix < l.prix_normal && <span className="block text-[11px] text-slate-400 line-through">{formaterGNF(l.prix_normal * l.quantite)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 text-sm"><span className="text-slate-500">Total articles</span><b className="whitespace-nowrap">{formaterGNF(d.total)}</b></div>
                  <p className="text-xs text-slate-600 mt-2">{d.mode_livraison === 'livraison' ? `Livraison : ${d.adresse || 'adresse à demander'}` : 'Retrait en boutique (Lambanyi)'}{d.note ? ` · ${d.note}` : ''}</p>
                  {d.traite_par_nom && <p className="text-[11px] text-slate-400 mt-1">Par {d.traite_par_nom}</p>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a href={lienAppel(d.client_telephone)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg px-2.5 py-1.5"><FiPhone size={13} /> {d.client_telephone}</a>
                    <a href={lienWhatsApp(d.client_telephone, `Bonjour ${d.client_nom}, c'est Koloun Luxure. Je confirme votre commande ${d.reference} (${formaterGNF(d.total)}).`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5"><FaWhatsapp size={14} /> Confirmer</a>
                    {d.statut === 'nouvelle' ? (
                      <>
                        <button onClick={() => traiter(d, 'traitee')} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-2.5 py-1.5"><FiCheck size={13} /> Traitée</button>
                        <button onClick={() => traiter(d, 'annulee')} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg px-2.5 py-1.5"><FiX size={13} /> Annuler</button>
                      </>
                    ) : (
                      <button onClick={() => traiter(d, 'nouvelle')} className="text-xs text-slate-500 underline">Remettre à traiter</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Discussion de test : vous jouez le client, l'agent répond avec le vrai stock
function Essai({ etat, onApresReponse }) {
  const [session, setSession] = useState(nouvelleSession);
  const [messages, setMessages] = useState([]); // { auteur: 'client'|'agent'|'info', texte?, images? }
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [humain, setHumain] = useState(false);
  const fil = useRef(null);
  useEffect(() => { fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' }); }, [messages, envoi]);

  const envoyer = async (t = texte) => {
    const message = t.trim(); if (!message || envoi) return;
    setTexte(''); setMessages((m) => [...m, { auteur: 'client', texte: message }]); setEnvoi(true);
    try {
      const r = await parlerAgent(message, session);
      setMessages((m) => [
        ...m,
        ...r.textes.map((x) => ({ auteur: 'agent', texte: x })),
        ...(r.images?.length ? [{ auteur: 'agent', images: r.images }] : []),
        ...(r.demande ? [{ auteur: 'info', texte: `Commande ${r.demande} transmise : elle apparaît à droite.` }] : []),
        ...(r.mode === 'humain' && !r.textes.length ? [{ auteur: 'info', texte: "L'agent vous a passé la main : il ne répond plus dans cette conversation." }] : []),
      ]);
      setHumain(r.mode === 'humain');
      onApresReponse();
    } catch (e) {
      setMessages((m) => [...m, { auteur: 'info', texte: e.response?.data?.message || "L'agent n'a pas pu répondre." }]);
    } finally { setEnvoi(false); }
  };

  const recommencer = () => { setSession(nouvelleSession()); setMessages([]); setHumain(false); };
  const rendre = async () => { await rendreLaMainAgent(session).catch(() => {}); setHumain(false); setMessages((m) => [...m, { auteur: 'info', texte: "L'agent reprend la conversation." }]); };

  return (
    <section className="card !p-0 overflow-hidden flex flex-col h-[560px] max-h-[75dvh]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#075e54] text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"><FiUser /></span>
          <div className="min-w-0"><p className="font-semibold text-sm truncate">Tester l'agent</p><p className="text-[11px] text-white/70 truncate">Vous jouez le client · vrai stock</p></div>
        </div>
        <button onClick={recommencer} className="text-xs inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"><FiRefreshCw size={12} /> Nouvelle</button>
      </div>

      <div ref={fil} className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 bg-[#efeae2]">
        {!messages.length && (
          <div className="text-center text-xs text-slate-600 bg-white/80 rounded-xl p-3">
            {etat && !etat.actif ? "L'agent n'est pas encore configuré : ajoutez la clé ANTHROPIC_API_KEY dans Render (voir le guide). En attendant, il répond par un message d'attente." : 'Écrivez comme un client, ou touchez un exemple :'}
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {EXEMPLES.map((x) => <button key={x} onClick={() => envoyer(x)} className="bg-white ring-1 ring-slate-200 rounded-full px-2.5 py-1 text-[11px] text-slate-700">{x}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (m.auteur === 'info' ? (
          <p key={i} className="text-center text-[11px] text-slate-600 bg-white/70 rounded-lg px-2 py-1 mx-auto w-fit max-w-[90%]">{m.texte}</p>
        ) : (
          <div key={i} className={`flex ${m.auteur === 'client' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm whitespace-pre-line break-words ${m.auteur === 'client' ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
              {m.texte && <TexteAgent texte={m.texte} />}
              {m.images && (
                <div className="grid grid-cols-2 gap-1.5">
                  {m.images.map((im, k) => (
                    <a key={k} href={im.url} target="_blank" rel="noreferrer" className="block">
                      <img src={im.url} alt={im.legende} className="w-full aspect-square object-cover rounded-lg bg-slate-100" loading="lazy" />
                    </a>
                  ))}
                  <p className="col-span-2 text-[11px] text-slate-500">{m.images[0]?.legende}</p>
                </div>
              )}
            </div>
          </div>
        )))}
        {envoi && <div className="flex"><div className="bg-white rounded-xl px-3 py-2 text-sm text-slate-400 shadow-sm">L'agent écrit…</div></div>}
      </div>

      {humain ? (
        <div className="p-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between gap-2">
          <p className="text-xs text-amber-800">Conversation passée au vendeur.</p>
          <button onClick={rendre} className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5">Rendre la main à l'agent</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); envoyer(); }} className="p-2 bg-white border-t border-slate-100 flex gap-2">
          <input className="input-champ !py-2 flex-1 min-w-0" placeholder="Écrire comme un client…" value={texte} onChange={(e) => setTexte(e.target.value)} disabled={envoi} aria-label="Message" />
          <button type="submit" disabled={envoi || !texte.trim()} className="w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 disabled:opacity-50" aria-label="Envoyer"><FiSend /></button>
        </form>
      )}
    </section>
  );
}
