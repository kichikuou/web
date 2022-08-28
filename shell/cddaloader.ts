// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, readFileAsArrayBuffer, DRIType, ald_getdata, gaException} from './util.js';
import {Reader} from './cdimage.js';
import {addToast} from './widgets.js';

export interface CDDALoader {
    getCDDA(track: number): Promise<string>;
}

export interface CDDALoaderSource {
    extractTrack(track: number): Promise<Blob>;
}

export class BasicCDDALoader implements CDDALoader {
    private cache: string[];
    private lastTrack: number | undefined;

    constructor(private source: CDDALoaderSource) {
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }

    async getCDDA(track: number): Promise<string> {
        if (!this.cache[track]) {
            const blob = await this.source.extractTrack(track);
            this.cache[track] = URL.createObjectURL(blob);
        }
        this.lastTrack = track;
        return this.cache[track];
    }

    private onVisibilityChange() {
        if (!document.hidden)
            return;
        for (let i = 0; i < this.cache.length; i++) {
            if (i !== this.lastTrack && this.cache[i])
                URL.revokeObjectURL(this.cache[i]);
        }
        const newCache: string[] = [];
        if (this.lastTrack)
            newCache[this.lastTrack] = this.cache[this.lastTrack];
        this.cache = newCache;
    }
}

// IOSCDDALoader provides an interface to reload image file to address the
// Mobile Safari issue where files become unreadable after 1-2 minutes.
// https://bugs.webkit.org/show_bug.cgi?id=203806
export class IOSCDDALoader implements CDDALoader {
    private mp3Cache: MP3Cache | undefined;
    private mp3Urls: string[] = [];
    private reloadToast: HTMLElement | undefined;

    constructor(private imageReader: Reader) {
        // Temporarily disable MP3Cache
    }

    async getCDDA(track: number): Promise<string> {
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
        } catch (e: any) {
            if (e.constructor.name === 'FileError' && e.code === 1)
                ga('send', 'event', 'CDDAload', 'NOT_FOUND_ERR');
            else
                gaException({type: 'CDDAload', name: e.constructor.name, code: e.code});
            let clone = document.importNode((<HTMLTemplateElement>$('#cdda-error')).content, true);
            if (this.reloadToast && this.reloadToast.parentElement)
                (<HTMLElement>this.reloadToast.querySelector('.btn-clear')).click();
            let reloadToast = this.reloadToast = addToast(clone, 'error');
            return new Promise(resolve => {
                reloadToast.querySelector('.cdda-reload-button')!.addEventListener('click', () => {
                    this.imageReader.reloadImage().then(() => {
                        ga('send', 'event', 'CDDAload', 'reloaded');
                        (<HTMLElement>reloadToast.querySelector('.btn-clear')).click();
                        if (this.mp3Cache)
                            this.mp3Cache.startSpeculativeCache(this.imageReader);
                        resolve(this.getCDDA(track));
                    });
                });
            });
        }
    }
}

const DB_NAME = 'cdda';
const STORE_NAME = 'tracks';
const SPECULATIVE_CACHE_INTERVAL = 15000;

// A helper class of IOSCDDALoader that encodes audio data to MP3 and store into IndexedDB.
class MP3Cache {
    private dbp: Promise<IDBDatabase>;
    private worker: Worker;
    private cachedTracks: number[] = [];
    private pendingEncodes = 0;

    constructor(key: string) {
        this.worker = new Worker('worker/cddacacheworker.js');
        this.worker.addEventListener('message', (msg) => this.handleWorkerMessage(msg.data));
        this.dbp = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                gaException({type: 'IDBOpen', err: req.error});
                reject(req.error);
            }
        });
        this.dbp.then(() => this.init(key));
    }

    convertAndStore(track: number, data: ArrayBuffer) {
        this.worker.postMessage({track, data}, [data]);
        this.pendingEncodes++;
        this.cachedTracks.push(track);
    }

    async getTrack(track: number): Promise<Blob | null> {
        try {
            return await this.get(track);
        } catch (err) {
            return null;
        }
    }

    startSpeculativeCache(imageReader: Reader) {
        setTimeout(async () => {
            if (this.pendingEncodes) {
                this.startSpeculativeCache(imageReader);
                return;
            }
            for (let t = 2; t < imageReader.maxTrack(); t++) {
                if (this.cachedTracks.includes(t))
                    continue;
                try {
                    let blob = await imageReader.extractTrack(t);
                    let buf = await readFileAsArrayBuffer(blob);
                    this.convertAndStore(t, buf);
                    ga('send', 'event', 'MP3Cache', 'speculativeCache');
                    this.startSpeculativeCache(imageReader);
                } catch (err) {}
                return;
            }
        }, SPECULATIVE_CACHE_INTERVAL);
    }

    private handleWorkerMessage(msg: {track: number, time: number, data: ArrayBuffer[]}) {
        const blob = new Blob(msg.data, {type: 'audio/mp3'});
        this.put(msg.track, blob);
        this.pendingEncodes--;
    }

    private async init(key: string): Promise<void> {
        const oldKey = await this.get('key');
        if (key != oldKey) {
            if (oldKey)
                ga('send', 'event', 'MP3Cache', 'purged');
            await this.clear();
            await this.put('key', key);
        } else {
            let req: IDBRequest;
            await this.withStore('readonly', (s) => { req = s.getAllKeys(); });
            this.cachedTracks = req!.result;
        }
    }

    private async get(key: number | string): Promise<any> {
        let req: IDBRequest;
        await this.withStore('readonly', (s) => { req = s.get(key); });
        return req!.result;
    }

    private put(key: number | string, val: any): Promise<void> {
        return this.withStore('readwrite', (s) => s.put(val, key));
    }

    private clear(): Promise<void> {
        return this.withStore('readwrite', (s) => s.clear());
    }

    private async withStore(mode: 'readonly' | 'readwrite', callback: (s: IDBObjectStore) => void): Promise<void> {
        const db = await this.dbp;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            transaction.oncomplete = () => resolve();
            transaction.onabort = (ev) => {
                gaException({type: 'IDBTransactionAbort', ev});
                reject(ev);
            }
            transaction.onerror = () => {
                gaException({type: 'IDBTransaction', err: transaction.error});
                reject(transaction.error);
            }
            setTimeout(() => reject('IDB transaction timeout'), 1000);
            callback(transaction.objectStore(STORE_NAME));
        });
    }
}

export class BGMLoader implements CDDALoaderSource {
    async extractTrack(track: number): Promise<Blob> {
        const buf = ald_getdata(DRIType.BGM, track - 1);
        if (!buf)
            throw new Error('BGMLoader: Invalid track ' + track);
        return new Blob([buf]);
    }
}
