/* VYUHA — offline cache
 * Network-first for navigation so updates land immediately, cache-first for
 * the static shell so the game still boots with no connection.
 */
const CACHE = 'vyuha-v16';
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
  './js/sanjaya.js',
  './js/ui.js',
  './js/stage.js',
  './js/game.js',
  './js/modes.js',
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
  './assets/art/opt/factions/chandravansh.webp',
  './assets/audio/sfx/clash.mp3',
  './assets/audio/sfx/volley.mp3',
  './assets/audio/sfx/chakra_turn.mp3',
  './assets/audio/sfx/piece_place.mp3',
  './assets/art/banners/chandravansh.jpg',
  './assets/art/banners/suryavansh.jpg',
  './assets/art/opt/ui/table.jpg',
  './assets/art/opt/ui/panel.jpg',
  './assets/art/opt/ui/day.jpg',
  './assets/art/opt/ui/night.jpg'
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

  // Code and markup go to the network first: a stale script against fresh HTML is
  // exactly what leaves the game stuck on its loading screen after a deploy.
  const isCode = /\.(js|css|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isCode) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Images and audio never change under the same name, so cache-first is right
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );

});
