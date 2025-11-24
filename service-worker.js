// service-worker.js — Reliable Store India
const CACHE_NAME = "reliable-store-v1.0.2";

// Add more URLs here to cache important assets for offline use
const ASSETS_TO_CACHE = [
  "/",
  "/assets/css/styles.css",
  "/assets/js/site_header.js",
  "/assets/js/supabase_client.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: cache minimal assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS_TO_CACHE);
      } catch (e) {
        // If caching fails, don't break install — still allow SW to install
        console.warn("SW install: caching failed", e);
      }
    })()
  );
});

// Activate: remove old caches and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      // take control of uncontrolled clients right away
      if (self.clients && self.clients.claim) {
        await self.clients.claim();
      }
    })()
  );
});

// Fetch: try cache first, then network; if network fails return cached navigation (for SPA/home)
self.addEventListener("fetch", (event) => {
  // For non-GET requests just fallback to network
  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        // Optionally cache fetched resources (runtime caching) — keep minimal for now
        return networkResponse;
      }).catch(() => {
        // If fetch fails (offline), try to serve navigation/home as fallback
        return caches.match("/");
      });
    })
  );
});

// Listen for a command from the page to skip waiting and activate new SW immediately
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
