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

// ---- Push notifications ---------------------------------------------------
// Payload is sent by supabase/functions/send-watering-reminders:
// { title, body, url?, tag?, badge_count? }
type ReminderPayload = { title: string; body: string; url?: string; tag?: string; badge_count?: number };

self.addEventListener("push", (event) => {
  let data: ReminderPayload = { title: "Greenhouse", body: "Some plants could use you today." };
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
