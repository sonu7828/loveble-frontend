const APP_CACHE_NAMES = new Set(["static-assets", "html-nav", "media-assets-v2"]);

function isAppCacheForThisRegistration(name) {
  const isWorkboxCache = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return APP_CACHE_NAMES.has(name) || (isWorkboxCache && name.endsWith(self.registration.scope));
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(
          cacheNames.filter(isAppCacheForThisRegistration).map((name) => caches.delete(name)),
        );
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);