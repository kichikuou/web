// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { MainModule as XSystem35Module } from './xsystem35.js';
import { ald_getdata, isMobileSafari, createBlob } from './util.js';

export interface CDDALoaderSource {
    hasAudioTrack(): boolean;
    extractTrack(track: number): Promise<Blob>;
}

export class CDDALoader {
    private cache: string[];
    private lastTrack: number | undefined;

    constructor(private source: CDDALoaderSource) {
        this.cache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));

        // Delete the CDDA cache created by (now removed) IOSCDDALoader.
        if (isMobileSafari()) {
            indexedDB.deleteDatabase('cdda');
        }
    }

    hasAudioTrack() {
        return this.source.hasAudioTrack();
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

export class BGMLoader implements CDDALoaderSource {
    constructor(private type: number, private base_no: number) {}

    hasAudioTrack(): boolean {
        return true;
    }

    async extractTrack(track: number): Promise<Blob> {
        const dfile = ald_getdata(Module as XSystem35Module, this.type, track + this.base_no - 1);
        if (!dfile)
            throw new Error('BGMLoader: Invalid track ' + track);
        return createBlob(dfile.data, dfile.name);
    }
}
