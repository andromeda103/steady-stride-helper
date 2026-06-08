self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({
          source: "levelup-notification-sw",
          kind: "active",
          detail: "Service Worker ativo",
        });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({
          source: "levelup-notification-sw",
          kind: "notification-click",
          detail: event.notification.title,
        });
      }
      const first = clients[0];
      if (first && "focus" in first) await first.focus();
    })(),
  );
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({
          source: "levelup-notification-sw",
          kind: "notification-close",
          detail: event.notification.title,
        });
      }
    })(),
  );
});