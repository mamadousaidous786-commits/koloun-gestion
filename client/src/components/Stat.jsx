import React from 'react';

const TEINTES = {
  bleu: 'bg-blue-50 text-blue-600',
  vert: 'bg-emerald-50 text-emerald-600',
  rouge: 'bg-red-50 text-red-600',
  orange: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  gris: 'bg-slate-100 text-slate-600',
};

// Petite carte de chiffre clé
export default function Stat({ icone, titre, valeur, detail, teinte = 'bleu' }) {
  return (
    <div className="card flex items-center gap-4 h-full min-h-[5.75rem]">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${TEINTES[teinte]}`}>{icone}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate" title={titre}>{titre}</p>
        <p className="text-lg font-bold text-slate-900 truncate leading-7">{valeur}</p>
        {/* Ligne toujours présente (même vide) : la carte garde la même hauteur avant et après le chargement */}
        <p className="text-xs text-slate-500 mt-0.5 truncate h-4">{detail || ''}</p>
      </div>
    </div>
  );
}
