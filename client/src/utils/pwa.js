import { useEffect, useState } from 'react';
import api from '../services/api';

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


// ---------------- Alertes (notifications push) ----------------
const b64 = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
};

export const alertesSupportees = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function abonnementActuel() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function alertesActives() {
  if (!alertesSupportees() || Notification.permission !== 'granted') return false;
  try { return !!(await abonnementActuel()); } catch { return false; }
}

export async function activerAlertes() {
  if (!alertesSupportees()) throw new Error("Ce navigateur ne gère pas les alertes. Sur iPhone, installez d'abord l'application (Partager > Sur l'écran d'accueil).");
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error("Autorisation refusée. Autorisez les notifications dans les réglages du téléphone/navigateur.");
  const reg = await navigator.serviceWorker.ready;
  let abo = await reg.pushManager.getSubscription();
  if (!abo) {
    const { data } = await api.get('/push/cle');
    abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(data.cle) });
  }
  await api.post('/push/abonner', abo.toJSON());
  return true;
}

export async function desactiverAlertes() {
  const abo = await abonnementActuel();
  if (abo) {
    await api.post('/push/desabonner', { endpoint: abo.endpoint }).catch(() => {});
    await abo.unsubscribe();
  }
}

export const testerAlertes = () => api.post('/push/test');

// Re-synchronise l'abonnement après connexion (au cas où l'utilisateur a changé) + bip quand l'application est ouverte
export function initialiserSon() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'son') bip();
  });
}

export function bip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (_) { /* son indisponible */ }
}

export async function resynchroniserAlertes() {
  try { if (await alertesActives()) { const abo = await abonnementActuel(); await api.post('/push/abonner', abo.toJSON()); } } catch (_) {}
}
