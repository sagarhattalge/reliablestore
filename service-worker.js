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
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // attempt to add each asset individually and log failures, do not throw
    for (const url of ASSETS_TO_CACHE) {
      try {
        // use fetch so we can inspect response and avoid addAll failing on opaque/404
        const resp = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
        if (!resp || !resp.ok) {
          console.warn(`SW: failed to fetch ${url} (status: ${resp ? resp.status : 'no-response'})`);
          continue;
        }
        // put a clone into cache
        await cache.put(url, resp.clone());
      } catch (err) {
        console.warn(`SW: caching ${url} failed`, err);
      }
    }
    // Ensure active worker takes control quickly (optional)
    try { await self.skipWaiting(); } catch (e) { /* ignore */ }
  })());
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
