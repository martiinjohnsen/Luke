/* Cache only the public shell. Account data never enters the service-worker cache. */
const CACHE = "luke-shell-2026-11-08-desktop-door-check-v21";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([
        "/offline.html",
        "/brand/luke-lockup.svg",
        "/icons/luke-192-v2.png",
        "/icons/luke-512-v2.png",
        "/icons/luke-apple-touch-v2.png",
        "/icons/luke-maskable-512.png",
        "/icons/luke-favicon-v2.png",
      ]);
      try {
        const response = await fetch("/calendars", { cache: "reload" });
        if (response.ok) {
          await cache.put("/calendars", response.clone());
          const html = await response.text();
          const assets = [
            ...new Set(
              [
                ...html.matchAll(
                  /(?:src|href)="(\/_next\/static\/[^"?#]+)[^"]*"/g,
                ),
              ].map((match) => match[1]),
            ),
          ];
          await Promise.allSettled(assets.map((asset) => cache.add(asset)));
        }
      } catch {
        /* Offline fallback still installs if the shell is temporarily unavailable. */
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("luke-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.searchParams.has("_rsc") ||
    request.headers.has("RSC")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (
            response.ok &&
            response.headers.get("Content-Type")?.includes("text/html")
          )
            await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match("/offline.html"))
          );
        }
      })(),
    );
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/fonts.css"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
