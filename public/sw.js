// Public Gym app: offline support. App files are cached so it opens at the gym with no signal.
// Bump VERSION whenever any file in SHELL changes, so phones pick up the update (close and reopen twice).
// This worker's scope is public/ only. It keeps its own caches (names starting "gymp-") and never touches the couple app's.
const VERSION = 'gymp-v3';
const SHELL = ['./', './index.html', './config.js', './core.js', './templates.js', './app.js', './extras.js', './coach.js', './motion.js', './friends.js', './chat.js', './challenges.js', './trainer.js', './auth.js', './onboard.js', './manifest.webmanifest',
  '../data.js', '../data-qxeen.js', '../figures.js', '../library.js', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './maskable-512.png'];
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))) // skip the HTTP cache so a new version never installs stale files
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
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net; if (res) return res;
    if (req.mode === 'navigate') return c.match('./index.html');
    return new Response('', { status: 504 });
  }));
});
