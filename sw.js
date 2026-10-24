// Bump VERSION whenever you change any file so phones get the update
const VERSION = "iqamah-v14";
const FILES = ["./", "index.html", "app.js", "schedule.js", "settings.js", "native.js", "picker.js", "manifest.json", "masjids/index.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))); // skip the browser's 10-minute HTTP cache
    try { await c.add("adhan.mp3"); } catch (err) {} // optional file
  }));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Network first (so updates show up), fall back to cache when offline
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.headers.has("range")) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then((res) => { // always revalidate, so files never mix versions
      if (res.ok && res.status === 200) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
// Tapping a reminder opens the app (and plays the adhan if chosen)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const wantsAdhan = e.notification.data && e.notification.data.adhan;
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) {
      const c = all[0];
      await c.focus();
      if (wantsAdhan) c.postMessage("play-adhan");
      return;
    }
    return clients.openWindow(wantsAdhan ? "./?adhan=1" : "./");
  })());
});





