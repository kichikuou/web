// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { DRIType, ald_getdata, isMobileSafari, createBlob, loadScript, createWaveFile } from './util.js';

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

    async getCDDA(track: number, target: HTMLAudioElement): Promise<string> {
        if (!this.cache[track]) {
            let blob = await this.source.extractTrack(track);
            if (blob.type === 'audio/ogg' && !target.canPlayType('audio/ogg')) {
                blob = await convertOggToWav(blob);
            }
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
        const dfile = ald_getdata(DRIType.BGM, track - 1);
        if (!dfile)
            throw new Error('BGMLoader: Invalid track ' + track);
        return createBlob(dfile.data, dfile.name);
    }
}

export class Rance4v2BGMLoader implements CDDALoaderSource {
    async extractTrack(track: number): Promise<Blob> {
        const dfile = ald_getdata(DRIType.WAVE, track - 2 + 1000);
        if (!dfile)
            throw new Error('Rance4v2BGMLoader: Invalid track ' + track);
        return createBlob(dfile.data, dfile.name);
    }
}

async function convertOggToWav(blob: Blob): Promise<Blob> {
    await loadScript('lib/stbvorbis-0.2.2.js');
    const buf = await blob.arrayBuffer();
    const chunks: Int16Array[] = [];
    let sampleRate = 0;
    let channels = 0;
    let dataSize = 0;
    return new Promise((resolve, reject) => {
        stbvorbis.decode(buf, (event) => {
            if (event.error) {
                reject(event.error);
            } else if (event.eof) {
                resolve(createWaveFile(sampleRate, channels, dataSize, chunks));
            } else {
                if (chunks.length === 0) {
                    sampleRate = event.sampleRate;
                    channels = event.data.length;
                }
                const chunk = new Int16Array(event.data[0].length * channels);
                let ptr = 0;
                for (let i = 0; i < event.data[0].length; i++) {
                    for (let j = 0; j < event.data.length; j++) {
                        chunk[ptr++] = event.data[j][i] * 0x7fff;
                    }
                }
                chunks.push(chunk);
                dataSize += chunk.byteLength;
            }
        });
    });
}
