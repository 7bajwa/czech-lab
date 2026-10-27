// Offline cache: the app shell is cached on install, every other same-origin GET is cached on first use.
// Pages are network-first (so updates arrive), everything else is cache-first (hashed build assets never change).
const CACHE = 'czechlab-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return // API calls etc. go straight to the network
  const put = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) } return res }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r ?? caches.match('./index.html'))))
  } else {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then(put)))
  }
})
