/* UNZUR push notifications (Firebase Cloud Messaging, data-only messages).
 * The API sends { title, body, url, tag, lang }; this worker shows it and opens
 * `url` on click. Open dashboard tabs are told too, so they refresh their lists. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    const json = event.data ? event.data.json() : {};
    data = json.data || json;
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "UNZUR";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    lang: data.lang || "ar",
    dir: data.lang === "en" ? "ltr" : "rtl",
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((tabs) => tabs.forEach((tab) => tab.postMessage({ type: "unzur-push", data }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const same = tabs.find((tab) => tab.url === target.href);
      if (same) return same.focus();
      const ours = tabs.find((tab) => new URL(tab.url).origin === target.origin);
      if (ours) return ours.navigate(target.href).then((tab) => tab && tab.focus());
      return self.clients.openWindow(target.href);
    }),
  );
});
