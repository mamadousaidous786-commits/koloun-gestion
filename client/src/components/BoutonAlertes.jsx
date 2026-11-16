import React, { useEffect, useState } from 'react';
import { FiBell, FiBellOff } from 'react-icons/fi';
import { alertesSupportees, alertesActives, activerAlertes, desactiverAlertes, testerAlertes } from '../utils/pwa';

// Bouton « Activer les alertes » : rupture de stock, etc. sur le téléphone, même application fermée
export default function BoutonAlertes({ className = '' }) {
  const [actif, setActif] = useState(false);
  const [msg, setMsg] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => { alertesActives().then(setActif); }, []);

  const basculer = async () => {
    setOccupe(true); setMsg('');
    try {
      if (actif) { await desactiverAlertes(); setActif(false); setMsg('Alertes désactivées.'); }
      else { await activerAlertes(); setActif(true); await testerAlertes(); setMsg('Alertes activées ✅'); }
    } catch (e) {
      setMsg(e.response?.data?.message || e.message || 'Impossible d\'activer les alertes.');
    } finally { setOccupe(false); }
  };

  if (!alertesSupportees() && !/iphone|ipad|ipod/i.test(navigator.userAgent)) return null;

  return (
    <div className={className}>
      <button type="button" onClick={basculer} disabled={occupe}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl py-2.5 transition disabled:opacity-60">
        {actif ? <FiBellOff /> : <FiBell />} {actif ? 'Désactiver les alertes' : 'Activer les alertes'}
      </button>
      {msg && <p className="mt-2 text-xs text-blue-100/80 leading-relaxed">{msg}</p>}
    </div>
  );
}
