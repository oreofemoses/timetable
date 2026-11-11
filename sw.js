// Offline support. Her data lives on the device already; this keeps the app
// itself (pages, scripts, fonts) available without internet.
//
// Everything is network first (always the newest when online), falling back
// to the saved copy when offline or the connection is too slow.
//
// When you add a new file to the app, add it to SHELL and bump VERSION.

const VERSION = "vida-v4";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "script.js",
  "shared.js",
  "store.js",
  "drawer.js",
  "planform.js",
  "notepad.js",
  "schedule.js",
  "todolist.js",
  "whenpicker.js",
  "todos.js",
  "entryeditor.js",
  "diary.js",
  "prefs.js",
  "reminders.js",
  "alarm.js",
  "settings.js",
  "favicon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "fonts/fredoka-latin.woff2",
  "fonts/fredoka-latin-ext.woff2",
  "fonts/gaegu-latin.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin === self.location.origin) e.respondWith(networkFirst(req));
});

// give up on a slow network after a few seconds and use the saved copy
function fetchWithin(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("slow")), ms);
    fetch(req).then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetchWithin(req, 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const saved = await cache.match(req, { ignoreSearch: true });
    if (saved) return saved;
    if (req.mode === "navigate") return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
    return Response.error();
  }
}
