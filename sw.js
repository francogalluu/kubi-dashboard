// Minimal service worker -- just enough for browsers to consider this an
// installable PWA. No offline caching: the data is live from Supabase and
// there's no point showing stale notes.
self.addEventListener("install", (event) => self.skipWaiting());
self.addEventListener("fetch", () => {});
