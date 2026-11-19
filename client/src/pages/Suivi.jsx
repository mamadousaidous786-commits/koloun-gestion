import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheck, FiPackage, FiPhone } from 'react-icons/fi';
import { consulterSuivi } from '../services/suiviService';
import { urlFichier } from '../utils/fichiers';
import { formaterDate, lienAppel } from '../utils/format';
import logo from '../assets/logo.jpeg';

// Page PUBLIQUE : le client suit sa commande spéciale avec le lien reçu par WhatsApp (sans compte)
export default function Suivi() {
  const { code } = useParams();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    consulterSuivi(code).then(setD).catch((e) => setErreur(e.response?.data?.message || 'Impossible de charger le suivi.'));
  }, [code]);

  const indexActuel = d ? d.etapes.reduce((n, e, i) => (e.date ? i : n), -1) : -1;
  const annulee = d?.statut === 'annulee';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <img src={logo} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto shadow" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">{d?.boutique?.nom || 'Koloun Luxure'}</h1>
          <p className="text-xs text-slate-500">Suivi de votre commande</p>
        </div>

        {erreur && <div className="card text-center text-slate-600 text-sm">{erreur}</div>}
        {!d && !erreur && <p className="text-center text-slate-400 text-sm">Chargement…</p>}

        {d && (
          <div className="card">
            <div className="flex gap-3 items-center">
              <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {d.image ? <img src={urlFichier(d.image, 300)} alt="" className="w-full h-full object-contain" /> : <FiPackage className="text-slate-300" size={26} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Bonjour {d.client},</p>
                <p className="font-semibold text-slate-900">{d.article}</p>
                {d.date_livraison_prevue && <p className="text-xs text-slate-500 mt-1">Livraison prévue le {formaterDate(d.date_livraison_prevue)}</p>}
              </div>
            </div>

            {(d.photos || []).length > 1 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {d.photos.map((p, i) => (
                  <figure key={i} className="min-w-0">
                    <div className="aspect-square rounded-lg bg-slate-100 overflow-hidden"><img src={urlFichier(p.image, 300)} alt={p.legende || ''} loading="lazy" className="w-full h-full object-cover" /></div>
                    {p.legende && <figcaption className="text-[11px] text-slate-500 mt-1 truncate">{p.legende}</figcaption>}
                  </figure>
                ))}
              </div>
            )}

            {annulee ? (
              <p className="mt-5 text-sm text-center text-red-600 bg-red-50 rounded-xl py-3">Cette commande a été annulée.</p>
            ) : (
              <ol className="mt-6">
                {d.etapes.map((e, i) => {
                  const fait = !!e.date;
                  const courante = i === indexActuel;
                  return (
                    <li key={e.statut} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${fait ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'} ${courante ? 'ring-4 ring-blue-100' : ''}`}>
                          {fait ? <FiCheck /> : i + 1}
                        </div>
                        {i < d.etapes.length - 1 && <div className={`w-0.5 flex-1 min-h-[28px] ${i < indexActuel ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm ${fait ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{e.label}</p>
                        {e.date && <p className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                        {e.note && <p className="text-xs text-slate-500 mt-0.5">{e.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {d.boutique?.telephone && (
              <a href={lienAppel(d.boutique.telephone)} className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl py-2.5">
                <FiPhone /> Nous appeler
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
