// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { DRIType, ald_getdata, isMobileSafari } from './util.js';

export interface CDDALoaderSource {
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
    async extractTrack(track: number): Promise<Blob> {
        const buf = ald_getdata(DRIType.BGM, track - 1);
        if (!buf)
            throw new Error('BGMLoader: Invalid track ' + track);
        return new Blob([buf]);
    }
}
