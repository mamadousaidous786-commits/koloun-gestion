/* Service worker Koloun Luxure : rend l'application installable et accélère son ouverture.
   - Fichiers de l'application (JS/CSS/images) : servis depuis le cache, mis à jour en arrière-plan.
   - Pages : réseau d'abord, sinon la dernière version en cache (ouverture même sans connexion).
   - Données de l'API : JAMAIS mises en cache ici (toujours à jour). */
const VERSION = 'kl-v9';
const COQUILLE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/logo.jpeg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                         // API Render, Cloudinary, etc. : réseau direct
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  // Navigation : réseau d'abord, repli sur la coque de l'application
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }

  // Fichiers statiques : cache d'abord + rafraîchissement silencieux
  e.respondWith(
    caches.match(req).then((enCache) => {
      const reseau = fetch(req).then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
        return rep;
      }).catch(() => enCache);
      return enCache || reseau;
    })
  );
});

// ---- Alertes (notifications push) : s'affichent même application fermée ----
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titre: 'Koloun Luxure', corps: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.titre || 'Koloun Luxure', {
      body: d.corps || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      vibrate: [200, 100, 200, 100, 300],
      requireInteraction: !!d.urgent,
      data: { url: d.url || '/notifications' },
    });
    // Application ouverte : on demande aussi un petit bip
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    fenetres.forEach((c) => c.postMessage({ type: 'son' }));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of fenetres) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url).catch(() => {}); return; }
    }
    await self.clients.openWindow(url);
  })());
});
