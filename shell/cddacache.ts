// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, readFileAsArrayBuffer, gaException} from './util.js';
import {Reader} from './cdimage.js';
import {addToast} from './widgets.js';

export interface CDDACache {
    getCDDA(track: number): Promise<string>;
}

export class BasicCDDACache implements CDDACache {
    private cache: string[];

    constructor(private imageReader: Reader) {
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }

    async getCDDA(track: number): Promise<string> {
        if (!this.cache[track]) {
            const blob = await this.imageReader.extractTrack(track);
            this.cache[track] = URL.createObjectURL(blob);
        }
        return this.cache[track];
    }

    private onVisibilityChange() {
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
export class IOSCDDACache implements CDDACache {
    private cache: {track: number, url: string, time: number}[];
    private reloadToast: HTMLElement | undefined;

    constructor(private imageReader: Reader) {
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }

    async getCDDA(track: number): Promise<string> {
        for (let entry of this.cache) {
            if (entry.track === track) {
                entry.time = performance.now();
                return entry.url;
            }
        }
        this.shrink(3);
        let blob = await this.imageReader.extractTrack(track);
        try {
            let buf = await readFileAsArrayBuffer(blob);
            blob = new Blob([buf], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            this.cache.unshift({track, url, time: performance.now()});
            return url;
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
                    this.imageReader.reloadImage().then(() => {
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
        while (this.cache.length > size)
            URL.revokeObjectURL(this.cache.pop()!.url);
    }

    private onVisibilityChange() {
        if (document.hidden)
            this.shrink(1);
    }
}
