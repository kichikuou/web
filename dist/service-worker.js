importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js');

let cacheOptions = {
    cacheName: 'kichikuou',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 100,
            purgeOnQuotaError: true,
        })
    ],
};

// Cache-first for fonts and sound patches.
workbox.routing.registerRoute(/\/(fonts|Tone_000|Drum_000)\//, new workbox.strategies.CacheFirst(cacheOptions));

// Network first for the game engines, shell.js and help pages.
workbox.routing.registerRoute(/\/(shell.js|(system3|xsystem35)\.(js|wasm)|help\/)/, new workbox.strategies.NetworkFirst(cacheOptions));

// Stale-while-revalidate for other same-origin resources
workbox.routing.registerRoute(/\//, new workbox.strategies.StaleWhileRevalidate(cacheOptions));
