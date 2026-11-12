/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

// App shell precache (list injected at build time by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// SPA: serve index.html for in-app navigations so the app opens offline from the home screen
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// ---- Plant photos, kept for offline use --------------------------------------
// Photos come from private storage through signed URLs whose token changes every hour, so cache
// them by path alone. A path never changes content (new photos get new paths), so the cache
// is always right: serve from it first, and fetch and keep anything not seen before.
const PHOTO_CACHE = "plant-photos-v1";
const PHOTO_PATH = "/storage/v1/object/sign/plant-photos/";

registerRoute(
  ({ url, request }) => request.destination === "image" && url.pathname.includes(PHOTO_PATH),
  async ({ url }) => {
    const key = url.origin + url.pathname;
    const cache = await caches.open(PHOTO_CACHE);
    const hit = await cache.match(key);
    if (hit) return hit;
    // Ask for a CORS response (Supabase allows it) so the status can be checked before keeping it.
    const res = await fetch(url.href.replace(/#.*$/, ""), { mode: "cors", credentials: "omit" });
    if (res.ok) await cache.put(key, res.clone());
    return res;
  },
);

// ---- Push notifications ---------------------------------------------------
// Payload is sent by supabase/functions/send-watering-reminders:
// { title, body, url?, tag?, badge_count? }
type ReminderPayload = { title: string; body: string; url?: string; tag?: string; badge_count?: number };

self.addEventListener("push", (event) => {
  let data: ReminderPayload = { title: "Rooted", body: "Some plants could use you today." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      // iOS shows a count on the home-screen icon once notifications are allowed
      const nav = self.navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void> };
      if (typeof data.badge_count === "number" && nav.setAppBadge) {
        await nav.setAppBadge(data.badge_count).catch(() => {});
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag ?? "watering",
        data: { url: data.url ?? "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
