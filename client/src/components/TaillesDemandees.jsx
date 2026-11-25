import React, { useEffect, useState } from 'react';
import { FiBell, FiChevronDown, FiPhone } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import api from '../services/api';
import { urlFichier } from '../utils/fichiers';
import { lienWhatsApp, lienAppel } from '../utils/format';

// Tailles épuisées que des clients de Koloun Boutique attendent (« Me prévenir »).
// Ils reçoivent une notification automatiquement dès que la taille revient en stock.
export default function TaillesDemandees() {
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => { api.get('/boutique/admin/alertes').then((r) => setListe(r.data)).catch(() => {}); }, []);
  if (!liste.length) return null;
  const total = liste.reduce((s, x) => s + x.clients.length, 0);

  return (
    <div className="card !p-0 mb-4 overflow-hidden">
      <button type="button" onClick={() => setOuvert(!ouvert)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><FiBell /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-slate-900">Tailles demandées par les clients</span>
          <span className="block text-xs text-slate-500">{liste.length} taille{liste.length > 1 ? 's' : ''} épuisée{liste.length > 1 ? 's' : ''} · {total} client{total > 1 ? 's' : ''} attend{total > 1 ? 'ent' : ''} leur retour (prévenus automatiquement)</span>
        </span>
        <FiChevronDown className={`shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>
      {ouvert && (
        <ul className="border-t border-slate-100 divide-y divide-slate-100">
          {liste.map((x) => (
            <li key={x.produit_taille_id} className="px-4 py-2.5">
              <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setDetail(detail === x.produit_taille_id ? null : x.produit_taille_id)}>
                <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">{x.image && <img src={urlFichier(x.image)} alt="" className="w-full h-full object-cover" />}</div>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800 truncate">{x.nom}</span>
                  <span className="block text-xs text-slate-500">Taille {x.taille}{x.stock > 0 ? ' · de retour, clients prévenus' : ' · épuisée'}</span>
                </span>
                <span className="badge bg-amber-50 text-amber-700 ring-amber-200 whitespace-nowrap">{x.clients.length} client{x.clients.length > 1 ? 's' : ''}</span>
              </button>
              {detail === x.produit_taille_id && (
                <ul className="mt-2 space-y-1.5 pl-[52px]">
                  {x.clients.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-700 mr-auto">{c.nom}</span>
                      {c.telephone && <a href={lienAppel(c.telephone)} className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 rounded-lg px-2 py-1"><FiPhone size={12} /> Appeler</a>}
                      {c.telephone && <a href={lienWhatsApp(c.telephone, `Bonjour ${c.nom}, c'est Koloun Luxure. Vous attendiez « ${x.nom} » en taille ${x.taille}. `)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1"><FaWhatsapp size={13} /> WhatsApp</a>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
