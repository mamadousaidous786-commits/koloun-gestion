import React, { useState } from 'react';
import { FiDownload, FiShare } from 'react-icons/fi';
import { useInstallation } from '../utils/pwa';

// Bouton « Installer l'application » : visible seulement quand l'installation est possible
export default function BoutonInstaller({ className = '' }) {
  const { peutInstaller, ios, installer } = useInstallation();
  const [aide, setAide] = useState(false);

  if (!peutInstaller && !ios) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => (peutInstaller ? installer() : setAide(!aide))}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-marine-900 bg-white hover:bg-blue-50 rounded-xl py-2.5 transition"
      >
        <FiDownload /> Installer l'application
      </button>
      {aide && (
        <p className="mt-2 text-xs text-blue-100/80 leading-relaxed">
          Sur iPhone : touchez <FiShare className="inline -mt-0.5" /> <b>Partager</b> dans Safari, puis <b>« Sur l'écran d'accueil »</b>.
        </p>
      )}
    </div>
  );
}
