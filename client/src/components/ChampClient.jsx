import React from 'react';

/**
 * Choix du client : un client déjà enregistré, ou un nouveau (nom + téléphone).
 * Un nouveau client est automatiquement ajouté à la fiche clients à l'enregistrement.
 * valeur = { client_id, nom, telephone }
 */
export default function ChampClient({ clients, valeur, onChange, libelleNom = 'Nom du client' }) {
  const choisir = (e) => {
    const id = e.target.value;
    if (!id) return onChange({ client_id: '', nom: '', telephone: '' });
    const c = clients.find((x) => String(x.id) === id);
    onChange({ client_id: c.id, nom: c.nom, telephone: c.telephone || '' });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="etiquette">Client</label>
        <select className="input-champ" value={valeur.client_id || ''} onChange={choisir}>
          <option value="">➕ Nouveau client (à saisir ci-dessous)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}{c.telephone ? ` — ${c.telephone}` : ''}</option>
          ))}
        </select>
      </div>

      {valeur.client_id ? (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          {valeur.nom}{valeur.telephone ? ` · ${valeur.telephone}` : ''}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="etiquette">{libelleNom}</label>
            <input required className="input-champ" placeholder="Ex : Aminata Diallo" value={valeur.nom}
              onChange={(e) => onChange({ ...valeur, nom: e.target.value })} />
          </div>
          <div>
            <label className="etiquette">Téléphone</label>
            <input className="input-champ" placeholder="Ex : 622 00 00 00" inputMode="tel" value={valeur.telephone}
              onChange={(e) => onChange({ ...valeur, telephone: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
