const CACHE_NAME = "habiku-pwa-cache-v7";
const OFFLINE_URL = "/offline";

/** Hanya aset statis — jangan pre-cache route HTML (memicu auth + RSC berat saat install PWA). */
const PRE_CACHE_RESOURCES = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/192",
  "/icons/512",
  "/icons/maskable",
];

// Install Event: Pre-cache shell and offline assets (jangan gagal total jika satu aset 404)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[PWA SW] Pre-caching offline shell resources");
      await Promise.all(
        PRE_CACHE_RESOURCES.map((url) =>
          cache.add(url).catch((error) => {
            console.warn("[PWA SW] Gagal pre-cache:", url, error);
          }),
        ),
      );
    }),
  );
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
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSupabaseStorageGet(url) {
  return (
    url.origin.includes("supabase.co") &&
    url.pathname.includes("/storage/v1/object/")
  );
}

function shouldBypassServiceWorker(request, url) {
  if (request.method !== "GET") return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next")) return true;
  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (request.headers.get("Next-Router-State-Tree")) return true;
  // REST/RPC Supabase (bukan file storage) — selalu segar dari jaringan
  if (url.origin.includes("supabase.co") && !isSupabaseStorageGet(url)) {
    return true;
  }
  return false;
}

function cacheFirstWithBackgroundUpdate(request) {
  return caches.match(request).then((cachedResponse) => {
    const networkUpdate = fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => null);

    if (cachedResponse) {
      void networkUpdate;
      return cachedResponse;
    }

    return networkUpdate.then(
      (networkResponse) =>
        networkResponse ||
        new Response("Offline", { status: 503, statusText: "Offline" }),
    );
  });
}

function staleWhileRevalidateNavigate(request) {
  return caches.match(request).then((cachedResponse) => {
    const networkFetch = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => null);

    if (cachedResponse) {
      void networkFetch;
      return cachedResponse;
    }

    return networkFetch.then(
      (response) => response || caches.match(OFFLINE_URL),
    );
  });
}

// Fetch Event: Caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldBypassServiceWorker(request, url)) {
    return;
  }

  if (isSupabaseStorageGet(url)) {
    event.respondWith(cacheFirstWithBackgroundUpdate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateNavigate(request));
    return;
  }

  event.respondWith(cacheFirstWithBackgroundUpdate(request));
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
    icon: "/icons/192",
    badge: "/icons/192",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/parent",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const url = event.notification.data?.url || "/parent";
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
