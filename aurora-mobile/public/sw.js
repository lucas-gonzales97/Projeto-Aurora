// Service worker mínimo — só o necessário pra instalar como PWA e carregar a
// casca offline. Chamadas /api NUNCA são cacheadas (precisam de rede/token).
const CACHE = "aurora-v1";
const SHELL = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api")) return; // deixa passar
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
