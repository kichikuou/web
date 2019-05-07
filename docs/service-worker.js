importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.0.0/workbox-sw.js');

let cacheOptions = {
    cacheName: 'kichikuou',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 100,
            purgeOnQuotaError: true,
        })
    ],
};

// Cache-first for fonts, versioned libraries, and sound patches
workbox.routing.registerRoute(/\/(fonts|lib|Tone_000|Drum_000)\//, new workbox.strategies.CacheFirst(cacheOptions));

// Network-first for other same-origin resources
workbox.routing.registerRoute(/\//, new workbox.strategies.NetworkFirst(cacheOptions));
