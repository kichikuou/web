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

// Cache-first for fonts and SoundFonts.
workbox.routing.registerRoute(/\/(fonts|soundfonts)\//, new workbox.strategies.CacheFirst(cacheOptions));

// Network first for other same-origin resources.
workbox.routing.registerRoute(/\//, new workbox.strategies.NetworkFirst(cacheOptions));
