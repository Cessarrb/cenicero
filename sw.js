// Cenicero: guarda una copia de la app para que abra sin señal.
// Páginas: primero intenta internet (para recibir actualizaciones) y si no hay
// señal o tarda más de 3 s, abre la copia guardada.
// Firebase y fuentes: usa la copia guardada (no cambian).
const CACHE = 'cenicero-v1';
const BASE = '/cenicero/';
const CORE = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icon-192.png', BASE + 'icon-512.png'];
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const FB_FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => FB + f);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(FB_FILES.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(3000)]);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const url = new URL(req.url);
      const page = url.pathname.startsWith(BASE + 'prueba/') ? BASE + 'prueba/' : BASE;
      return (await c.match(page)) || (await c.match(BASE + 'index.html'));
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith(BASE)) {
    e.respondWith(networkFirst(req));
  } else if (url.href.startsWith('https://www.gstatic.com/firebasejs/') ||
             url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
  // Todo lo demás (Firestore, inicio de sesión) va directo; Firebase ya guarda los datos por su cuenta.
});
