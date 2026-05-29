const CACHE_NAME = "habiku-pwa-cache-v1";
const OFFLINE_URL = "/offline";

const PRE_CACHE_RESOURCES = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/globe.svg",
  "/window.svg",
  "/file.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install Event: Pre-cache shell and offline assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA SW] Pre-caching offline shell resources");
      return cache.addAll(PRE_CACHE_RESOURCES);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[PWA SW] Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Bypass non-GET requests (e.g. Supabase POST/INSERT, Edge functions, APIs)
  if (request.method !== "GET") {
    return;
  }

  // 2. Bypass Supabase auth endpoints and websockets
  if (url.origin.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. For dynamic Webpages / Pages: Network First with Cache and Offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Put clone into dynamic cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If completely offline and not cached, return offline fallback page
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // 4. For static assets (Fonts, Images, CSS, SVG, JS): Cache First with network update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, but fetch fresh in background to update cache
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            /* ignore background fetch failures when offline */
          });
        return cachedResponse;
      }

      // Fetch from network and put in cache dynamically
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return networkResponse;
      });
    })
  );
});

// ==========================================
// Web Push Notifications Event Handlers
// ==========================================
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "Habiku";
  const options = {
    body: data.body || "Ada pembaruan penting di Habiku! ⚡",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/parent",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || "/parent";
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

