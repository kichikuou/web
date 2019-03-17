importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.0.0/workbox-sw.js');

let cacheOptions = {
    cacheName: 'kichikuou',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 50,
            purgeOnQuotaError: true,
        })
    ],
};

// Cache-first for fonts and versioned libraries
workbox.routing.registerRoute(/\/(fonts|lib)\//, new workbox.strategies.CacheFirst(cacheOptions));

// Network-first for other same-origin resources
workbox.routing.registerRoute(/\//, new workbox.strategies.NetworkFirst(cacheOptions));
