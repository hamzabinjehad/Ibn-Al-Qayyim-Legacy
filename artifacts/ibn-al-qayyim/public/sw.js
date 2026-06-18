const CACHE_VERSION = "v4";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-${CACHE_VERSION}`;
const BOOK_CACHE = "books-offline"; // Not versioned — persists across SW updates

function isShellRequest(url) {
  return ["", "/", ".html", ".js", ".css", ".woff2", ".woff",
          ".svg", ".ico", ".png", ".webp", ".jpg"]
    .some((ext) => ext === "" ? url.pathname === "/" : url.pathname.endsWith(ext));
}

function isLibraryDataRequest(url) {
  return url.pathname.includes("/library-data/");
}

function isFontRequest(url) {
  return url.hostname.includes("fonts.googleapis.com") ||
         url.hostname.includes("fonts.gstatic.com");
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(["/", "/index.html"]).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, DATA_CACHE, FONT_CACHE, BOOK_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Library JSON — check BOOK_CACHE first (explicitly saved books), then stale-while-revalidate
  if (isLibraryDataRequest(url)) {
    event.respondWith(
      caches.open(BOOK_CACHE).then(async (bookCache) => {
        const saved = await bookCache.match(event.request);
        if (saved) return saved;

        return caches.open(DATA_CACHE).then(async (dataCache) => {
          const cached = await dataCache.match(event.request);
          const fresh = fetch(event.request)
            .then((r) => { if (r.ok) dataCache.put(event.request, r.clone()); return r; })
            .catch(() => null);
          return cached ?? (await fresh) ?? new Response("Offline", { status: 503 });
        });
      })
    );
    return;
  }

  // Google Fonts — cache-first (fonts rarely change)
  if (isFontRequest(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const r = await fetch(event.request).catch(() => null);
        if (r?.ok) cache.put(event.request, r.clone());
        return r ?? new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // App shell (JS/CSS/images) — cache-first, network fallback
  if (isShellRequest(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const r = await fetch(event.request).catch(() => null);
        if (r?.ok) cache.put(event.request, r.clone());
        return r ?? new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
