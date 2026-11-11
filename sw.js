// sw.js — Z108 offline play for the home-screen web app (iPhone/iPad "Add to Home Screen", Android "Install").
// Nothing is precached by hand: the first online launch loads the whole module graph and every response lands in the cache.
//   · game files (same origin): NETWORK-ONLY while online, the cache only when the network fails (offline) → a deploy is picked
//     up on the next launch and a slow network never mixes old cached modules with new ones;
//   · three.js on jsDelivr is pinned to an exact version → CACHE-FIRST (immutable);
//   · images under assets/ and the Google Fonts stylesheet → served from cache at once, refreshed in the background;
//   · Google font files → cache-first.
const CACHE = 'ss-v1';
const IMMUTABLE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/three@\d|fonts\.gstatic\.com\/)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for(const k of await caches.keys()) if(k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const keep = async (req, res) => { if(res && (res.ok || res.type === 'opaque')) { const c = await caches.open(CACHE); await c.put(req, res.clone()); } return res; };

async function networkFirst(req, nav){
  try{ return await keep(req, await fetch(req)); }                  // always the network while there is one, however slow: a fallback
  catch(e){                                                          // on "slow" would mix cached (old) modules with fresh (new) ones
    const r = (await caches.match(req, nav ? { ignoreSearch: true } : undefined)) || (nav ? await caches.match('./', { ignoreSearch: true }) : undefined);
    if(r) return r; throw e;                                         // offline → the copy from the last online launch
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
