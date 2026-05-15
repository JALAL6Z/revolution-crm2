const CACHE = "revolution-crm-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Push notifications ───────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: "Revolution CRM", body: e.data.text() }; }

  const {
    title = "Revolution CRM",
    body = "",
    icon = "/favicon.png",
    badge = "/favicon.png",
    url = "/",
    tag,
  } = payload;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || "revolution-crm",
      data: { url },
      vibrate: [100, 50, 100],
    })
  );
});

// Clic sur notif → ouvre la bonne page
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => c.url.includes(self.location.origin));
      if (win) { win.focus(); win.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// ── Fetch — réseau d'abord, cache en fallback ─────────────────────────────
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).catch(() => caches.match(req).then((c) => c || caches.match("/")))
  );
});
