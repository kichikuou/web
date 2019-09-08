// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, readFileAsArrayBuffer, gaException} from './util.js';
import {loader} from './loader.js';
import {addToast} from './widgets.js';

export interface CDDACache {
    getCDDA(track: number): Promise<Blob>;
}

export class BasicCDDACache implements CDDACache {
    private blobCache: Blob[];

    constructor() {
        this.blobCache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }

    async getCDDA(track: number): Promise<Blob> {
        if (this.blobCache[track])
            return this.blobCache[track];
        let blob = await loader.getCDDA(track);
        this.blobCache[track] = blob;
        return blob;
    }

    private onVisibilityChange() {
        if (document.hidden)
            this.blobCache = [];
    }
}

export class IOSCDDACache implements CDDACache {
    private cache: {track: number, data: Blob, time: number}[];
    private reloadToast: HTMLElement | undefined;

    constructor() {
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }

    async getCDDA(track: number): Promise<Blob> {
        for (let entry of this.cache) {
            if (entry.track === track) {
                entry.time = performance.now();
                return entry.data;
            }
        }
        this.shrink(3);
        let blob = await loader.getCDDA(track);
        try {
            let buf = await readFileAsArrayBuffer(blob);
            blob = new Blob([buf], { type: 'audio/wav' });
            this.cache.unshift({track, data: blob, time: performance.now()});
            return blob;
        } catch (e) {
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
                    loader.reloadImage().then(() => {
                        ga('send', 'event', 'CDDAload', 'reloaded');
                        (<HTMLElement>reloadToast.querySelector('.btn-clear')).click();
                        resolve(this.getCDDA(track));
                    });
                });
            });
        }
    }

    private shrink(size: number) {
        if (this.cache.length <= size)
            return;
        this.cache.sort((a, b) => b.time - a.time);
        this.cache.length = size;
    }

    private onVisibilityChange() {
        if (document.hidden)
            this.shrink(1);
    }
}
