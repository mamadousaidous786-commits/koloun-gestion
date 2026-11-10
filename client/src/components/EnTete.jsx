import React from 'react';

// En-tête de page : titre, sous-titre et zone d'actions (boutons)
export default function EnTete({ titre, sousTitre, icone, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="titre-or text-2xl flex items-center gap-2.5">
          {icone && <span className="text-blue-600">{icone}</span>}
          {titre}
        </h1>
        {sousTitre && <p className="text-sm text-slate-500 mt-1">{sousTitre}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 no-print">{children}</div>}
    </div>
  );
}
