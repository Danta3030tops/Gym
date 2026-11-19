// Public Gym app: offline support. App files are cached so it opens at the gym with no signal.
// Bump VERSION whenever any file in SHELL changes, so phones pick up the update (close and reopen twice).
// This worker's scope is public/ only. It keeps its own caches (names starting "gymp-") and never touches the couple app's.
const VERSION = 'gymp-v15';
const SHELL = ['./', './index.html', './config.js', './core.js', './templates.js', './exlib.js', './plan.js', './autoplan.js', './mymeals.js', './app.js', './extras.js', './coach.js', './motion.js', './friends.js', './chat.js', './challenges.js', './trainer.js', './meals.js', './foodsearch.js', './foods.json', './bigz.js', './people.js', './auth.js', './onboard.js', './manifest.webmanifest',
  '../data.js', '../data-qxeen.js', '../figures.js', '../library.js', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './maskable-512.png'];
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.min.js'; // must match the script tag in index.html
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))) // skip the HTTP cache so a new version never installs stale files
    .then(c => fetch(LIB, { mode: 'cors' }).then(r => r.ok && caches.open(VERSION).then(k => k.put(LIB, r))).catch(() => { })) // keep the Supabase library too, so the app still starts offline; never blocks the install
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gymp-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin, cdn = CDN.includes(url.hostname);
  if (!same && !cdn) return; // Supabase API & storage always go to the network
  // stale-while-revalidate: answer from cache instantly, refresh in the background
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: same });
    const grab = () => fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; });
    const net = grab().catch(() => hit ? null : grab().catch(() => null)); // nothing cached to fall back on: one more go before giving up
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net; if (res) return res;
    const any = await caches.match(req, { ignoreSearch: same }); if (any) return any; // a copy kept by an earlier version beats nothing
    if (req.mode === 'navigate') return c.match('./index.html');
    return new Response('', { status: 504 });
  }));
});
