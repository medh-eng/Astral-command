/* Aetherfront: Astral Command — offline cache
 * Network-first for navigation so updates land immediately, cache-first for
 * the static shell so the game still boots with no connection.
 */
const CACHE = 'aetherfront-v8';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/units.js',
  './js/geometry.js',
  './js/engine.js',
  './js/ai.js',
  './js/audio.js',
  './js/storage.js',
  './js/art.js',
  './js/fx.js',
  './js/ui.js',
  './js/game.js',
  './js/main.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/hero.jpg',
  './assets/art/opt/units/senapati.webp',
  './assets/art/opt/units/maharathi.webp',
  './assets/art/opt/units/ashvarohi.webp',
  './assets/art/opt/units/dhanurdhar.webp',
  './assets/art/opt/units/divyadrishti.webp',
  './assets/art/opt/units/yantrik.webp',
  './assets/art/opt/units/rath.webp',
  './assets/art/opt/units/chara.webp',
  './assets/art/opt/units/shataghni.webp',
  './assets/art/opt/units/durg.webp',
  './assets/art/opt/factions/suryavansh.webp',
  './assets/art/opt/factions/chandravansh.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let fonts/CDNs go to the network

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
