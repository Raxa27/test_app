// Minimal service worker so browsers offer "Install app". Always uses the network:
// the assistant needs the server to answer anyway.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(fetch(event.request)));
