/*
 * §19.4 — Web Push handlers, imported into the workbox-generated service worker
 * via `importScripts` (vite.config.ts → VitePWA workbox.importScripts).
 *
 * Kept as a separate plain-JS file on purpose: the app's caching service worker
 * is carefully tuned and has broken releases before, so this touches none of it
 * — it only adds two event listeners to the same worker.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Mordheim Campaign Manager';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // A tag lets a re-sent reminder for the same event replace the old one
    // rather than stack a second notification.
    tag: payload.tag || undefined,
    data: { url: payload.url || '/app' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        // Reuse an open app tab, steering it to the target, rather than opening
        // a second one.
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== target) {
            try {
              await client.navigate(target);
            } catch (err) {
              /* navigate can reject across origins; focusing is enough. */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
