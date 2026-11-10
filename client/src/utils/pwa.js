import { useEffect, useState } from 'react';

// Installation de l'application (téléphone et ordinateur)
let evenementInstall = null;
const ecouteurs = new Set();
const notifier = () => ecouteurs.forEach((f) => f());

export const dejaInstallee = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Appelé une seule fois au démarrage (main.jsx) : enregistre le service worker et capte l'invitation d'installation
export function initialiserPwa() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // on affiche notre propre bouton « Installer »
    evenementInstall = e;
    notifier();
  });
  window.addEventListener('appinstalled', () => { evenementInstall = null; notifier(); });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

export async function installer() {
  if (!evenementInstall) return false;
  evenementInstall.prompt();
  const { outcome } = await evenementInstall.userChoice;
  evenementInstall = null;
  notifier();
  return outcome === 'accepted';
}

// Hook : { peutInstaller (Android/ordinateur), ios (iPhone : instructions manuelles), installer }
export function useInstallation() {
  const [, forcer] = useState(0);
  useEffect(() => {
    const f = () => forcer((n) => n + 1);
    ecouteurs.add(f);
    return () => ecouteurs.delete(f);
  }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !dejaInstallee();
  return { peutInstaller: !!evenementInstall && !dejaInstallee(), ios, installer };
}
