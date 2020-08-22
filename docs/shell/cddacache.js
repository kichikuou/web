// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, readFileAsArrayBuffer, gaException } from './util.js';
import { addToast } from './widgets.js';
export class BasicCDDACache {
    constructor(imageReader) {
        this.imageReader = imageReader;
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }
    async getCDDA(track) {
        if (!this.cache[track]) {
            const blob = await this.imageReader.extractTrack(track);
            this.cache[track] = URL.createObjectURL(blob);
        }
        return this.cache[track];
    }
    onVisibilityChange() {
        if (document.hidden) {
            for (const url of this.cache) {
                if (url)
                    URL.revokeObjectURL(url);
            }
            this.cache = [];
        }
    }
}
// IOSCDDACache provides an interface to reload image file to address the
// Mobile Safari issue where files become unreadable after 1-2 minutes.
// https://bugs.webkit.org/show_bug.cgi?id=203806
export class IOSCDDACache {
    constructor(imageReader) {
        this.imageReader = imageReader;
        this.mp3Urls = [];
        if (imageReader.cddaCacheKey)
            this.mp3Cache = new MP3Cache(imageReader.cddaCacheKey);
    }
    async getCDDA(track) {
        if (this.mp3Urls[track])
            return this.mp3Urls[track];
        if (this.mp3Cache) {
            const mp3 = await this.mp3Cache.getTrack(track);
            if (mp3) {
                const url = URL.createObjectURL(mp3);
                this.mp3Urls[track] = url;
                return url;
            }
        }
        let blob = await this.imageReader.extractTrack(track);
        try {
            if (this.mp3Cache) {
                let buf = await readFileAsArrayBuffer(blob);
                this.mp3Cache.convertAndStore(track, buf);
            }
            return URL.createObjectURL(blob);
        }
        catch (e) {
            if (e.constructor.name === 'FileError' && e.code === 1)
                ga('send', 'event', 'CDDAload', 'NOT_FOUND_ERR');
            else
                gaException({ type: 'CDDAload', name: e.constructor.name, code: e.code });
            let clone = document.importNode($('#cdda-error').content, true);
            if (this.reloadToast && this.reloadToast.parentElement)
                this.reloadToast.querySelector('.btn-clear').click();
            let reloadToast = this.reloadToast = addToast(clone, 'error');
            return new Promise(resolve => {
                reloadToast.querySelector('.cdda-reload-button').addEventListener('click', () => {
                    this.imageReader.reloadImage().then(() => {
                        ga('send', 'event', 'CDDAload', 'reloaded');
                        reloadToast.querySelector('.btn-clear').click();
                        resolve(this.getCDDA(track));
                    });
                });
            });
        }
    }
}
const DB_NAME = 'cdda';
const STORE_NAME = 'tracks';
// A helper class of IOSCDDACache that encodes audio data to MP3 and store into IndexedDB.
class MP3Cache {
    constructor(key) {
        this.worker = new Worker('worker/cddacacheworker.js');
        this.worker.addEventListener('message', (msg) => this.handleWorkerMessage(msg.data));
        this.dbp = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                gaException({ type: 'IDBOpen', err: req.error });
                reject(req.error);
            };
        });
        this.dbp.then(() => this.init(key));
    }
    convertAndStore(track, data) {
        this.worker.postMessage({ track, data }, [data]);
    }
    async getTrack(track) {
        try {
            return await this.get(track);
        }
        catch (err) {
            return null;
        }
    }
    handleWorkerMessage(msg) {
        const blob = new Blob(msg.data, { type: 'audio/mp3' });
        this.put(msg.track, blob);
    }
    async init(key) {
        const oldKey = await this.get('key');
        if (key != oldKey) {
            if (oldKey)
                ga('send', 'event', 'MP3Cache', 'purged');
            await this.clear();
            await this.put('key', key);
        }
    }
    async get(key) {
        let req;
        await this.withStore('readonly', (s) => { req = s.get(key); });
        return req.result;
    }
    put(key, val) {
        return this.withStore('readwrite', (s) => s.put(val, key));
    }
    clear() {
        return this.withStore('readwrite', (s) => s.clear());
    }
    async withStore(mode, callback) {
        const db = await this.dbp;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            transaction.oncomplete = () => resolve();
            transaction.onabort = (ev) => {
                gaException({ type: 'IDBTransactionAbort', ev });
                reject(ev);
            };
            transaction.onerror = () => {
                gaException({ type: 'IDBTransaction', err: transaction.error });
                reject(transaction.error);
            };
            setTimeout(() => reject('IDB transaction timeout'), 1000);
            callback(transaction.objectStore(STORE_NAME));
        });
    }
}
