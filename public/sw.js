const CACHE_NAME = "fc-v6-fix";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"
];

// 1. INSTALLATION
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATION
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. FETCH
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // 🔴 CRITIQUE : On laisse passer TOUT ce qui touche à Google API ou Gemini
  if (url.includes('google') || url.includes('generativelanguage') || url.includes('googleapis')) {
    return; // On laisse le navigateur gérer la requête réseau directement
  }

  // Pour le reste (assets statiques), on utilise le cache
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stratégie Stale-While-Revalidate simple
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // En cas d'erreur réseau sur un asset non critique, on ne fait rien
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. NOTIFICATIONS
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});