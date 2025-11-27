// service-worker.js — Reliable Store India (robust, fault-tolerant version)
const CACHE_NAME = "reliable-store-v1.0.2";

// IMPORTANT: only list same-origin assets you control here.
const ASSETS_TO_CACHE = [
  "/",
  "/assets/css/styles.css",
  "/assets/js/site_header.js",
  "/assets/js/supabase_client.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

// Install: cache assets one-by-one so a single 404 won't abort the whole install.
self.addEventListener("fetch", (event) => {
  // Bypass SW for Supabase auth and API calls, and for manifest/icons
  const reqUrl = event.request.url;
  if (reqUrl.includes('supabase.co') || reqUrl.includes('/auth/') || reqUrl.endsWith('/manifest.webmanifest') || reqUrl.includes('/icons/') || reqUrl.includes('/assets/icons/')) {
    // Just go to network (do not try cache)
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

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

// Activate: remove old caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    if (self.clients && self.clients.claim) {
      await self.clients.claim();
    }
  })());
});

// Fetch: cache-first for same-origin resources; network fallback; navigation fallback to "/"
self.addEventListener("fetch", (event) => {
  // only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  const req = event.request;
  const url = new URL(req.url);

  // For navigation requests (e.g. user typing a URL / SPA navigation) return cached "/" as fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then(cached => cached || caches.match("/")).then(result => {
        if (result) return result;
        // fall back to network
        return fetch(req).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // For same-origin requests, use cache-first then network (and optionally cache successful network responses)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(req).then((networkResponse) => {
          // only cache OK responses and same-origin GETs
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              try { cache.put(req, copy); } catch (e) { /* ignore cache errors */ }
            });
          }
          return networkResponse;
        }).catch(() => {
          // network failed — try navigation fallback
          return caches.match("/");
        });
      })
    );
    return;
  }

  // For cross-origin resources: prefer network (avoid caching third-party by default)
  event.respondWith(fetch(req).catch(() => caches.match("/")));
});

// Message handler (skip waiting)
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
