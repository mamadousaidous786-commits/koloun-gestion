import React, { useEffect, useState } from 'react';
import { FiBell, FiCheck, FiTrash2 } from 'react-icons/fi';
import { listerNotifications, marquerLue, supprimerNotification, supprimerToutesNotifications } from '../services/notificationService';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  const charger = async () => {
  try {
    const data = await listerNotifications();
    setNotifications(data);
  } catch (error) {
    console.error(error);
  }
};

useEffect(() => {
  charger();
}, []);
  const lire = async (id) => { await marquerLue(id); charger(); };

  const supprimer = async (id) => {
    await supprimerNotification(id);
    charger();
  };

  const supprimerTout = async () => {
    if (!confirm('Supprimer toutes les notifications ?')) return;
    await supprimerToutesNotifications();
    charger();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="titre-or text-2xl">Notifications</h1>
        {notifications.length > 0 && (
          <button onClick={supprimerTout} className="btn-secondary text-sm flex items-center gap-2">
            <FiTrash2 size={14} /> Tout supprimer
          </button>
        )}
      </div>
      <div className="card space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className={`flex items-center justify-between p-3 rounded-lg ${n.lue ? 'bg-charbon-800/50' : 'bg-or-500/10 border border-or-600/20'}`}>
            <div className="flex items-center gap-3">
              <FiBell className={n.lue ? 'text-charbon-100/40' : 'text-or-300'} />
              <div>
                <p className="text-sm text-charbon-50">{n.message}</p>
                <p className="text-xs text-charbon-100/40">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!n.lue && <button onClick={() => lire(n.id)} className="text-or-300" title="Marquer comme lue"><FiCheck /></button>}
              <button onClick={() => supprimer(n.id)} className="text-red-500 hover:text-red-600" title="Supprimer"><FiTrash2 size={14} /></button>
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-charbon-100/40 text-sm">Aucune notification.</p>}
      </div>
    </div>
  );
}
