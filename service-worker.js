// service-worker.js — Reliable Store India
const CACHE_NAME = "reliable-store-v1";
const ASSETS_TO_CACHE = [ "/" ];

// Install: cache minimal assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
});

// Activate: remove old caches and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      // take control of uncontrolled clients right away
      if (self.clients && clients.claim) await clients.claim();
    })()
  );
});

// Fetch: cache-first then network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Listen for a command from the page to skip waiting and activate new SW immediately
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
