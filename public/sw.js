/* Homeroom service worker: delivers reminder notifications on web builds
   (survives tab backgrounding) and handles taps + future push messages. */

self.addEventListener("install", (event) => {
  // Activate immediately so reminders route through the SW on first visit.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Future backend push: { title, body } payload shows an OS-level notification.
self.addEventListener("push", (event) => {
  let title = "Homeroom reminder";
  let body = "Something is due soon.";
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data === "object") {
      if (typeof data.title === "string") title = data.title;
      if (typeof data.body === "string") body = data.body;
    }
  } catch {
    // Non-JSON push: keep the defaults.
  }
  event.waitUntil(
    self.registration.showNotification(title, { body }),
  );
});

// Tapping a notification focuses the app (or opens it).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      if (clients.length > 0) {
        await clients[0].focus();
      } else if (self.clients.openWindow) {
        await self.clients.openWindow("./");
      }
    })(),
  );
});
