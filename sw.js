// sw.js — Z108 offline play for the home-screen web app (iPhone/iPad "Add to Home Screen", Android "Install").
// Nothing is precached by hand: the first online launch loads the whole module graph and every response lands in the cache.
//   · game files (same origin): NETWORK-FIRST → a deploy is picked up on the next launch, never a mix of old and new modules
//     (the cache is only the fallback when offline, or when the network is slower than NET_WAIT);
//   · three.js on jsDelivr is pinned to an exact version → CACHE-FIRST (immutable);
//   · images under assets/ and the Google Fonts stylesheet → served from cache at once, refreshed in the background;
//   · Google font files → cache-first.
const CACHE = 'ss-v1', NET_WAIT = 4000;
const IMMUTABLE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/three@\d|fonts\.gstatic\.com\/)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for(const k of await caches.keys()) if(k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const keep = async (req, res) => { if(res && (res.ok || res.type === 'opaque')) { const c = await caches.open(CACHE); await c.put(req, res.clone()); } return res; };

async function networkFirst(req, nav){
  const net = fetch(req).then((r) => keep(req, r)); net.catch(() => {});
  const cached = () => caches.match(req, nav ? { ignoreSearch: true } : undefined).then((r) => r || (nav ? caches.match('./', { ignoreSearch: true }) : undefined));
  const slow = new Promise((ok) => setTimeout(ok, NET_WAIT, 'slow'));
  try{
    const r = await Promise.race([net, slow]);
    if(r !== 'slow') return r;
    return (await cached()) || (await net);           // slow network: answer from cache now, the fetch still refreshes it
  }catch(e){
    const r = await cached(); if(r) return r; throw e;   // offline
  }
}
async function cacheFirst(req){ return (await caches.match(req)) || keep(req, await fetch(req)); }
async function staleWhileRevalidate(req){
  const hit = await caches.match(req), net = fetch(req).then((r) => keep(req, r)).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = req.url;
  if(IMMUTABLE.test(url)) return e.respondWith(cacheFirst(req));
  if(url.startsWith('https://fonts.googleapis.com/')) return e.respondWith(staleWhileRevalidate(req));
  const u = new URL(url);
  if(u.origin === self.location.origin && /\/assets\//.test(u.pathname)) return e.respondWith(staleWhileRevalidate(req));   // art: instant from cache, refreshed behind
  if(u.origin === self.location.origin) return e.respondWith(networkFirst(req, req.mode === 'navigate'));
});
