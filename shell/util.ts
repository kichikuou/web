// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { MainModule as System3Module } from './system3.js';
import type { MainModule as XSystem35Module } from './xsystem35.js';

export const $: (selector: string) => HTMLElement = document.querySelector.bind(document);

export const urlParams = new URLSearchParams(location.search.slice(1));
export const JSZIP_SCRIPT = 'lib/jszip.3.1.3.min.js';

const scriptPromises: Map<string, Promise<any>> = new Map();
export function loadScript(src: string): Promise<any> {
    let p = scriptPromises.get(src);
    if (!p) {
        let e = document.createElement('script');
        e.src = src;
        p = new Promise((resolve, reject) => {
            e.addEventListener('load', resolve, {once: true});
            e.addEventListener('error', reject, {once: true});
        });
        document.body.appendChild(e);
        scriptPromises.set(src, p);
    }
    return p;
}

export function isMobileSafari(from?: string, to?: string): boolean {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return (!from || from <= ver) && (!to || ver < to);
}

export function createBlob(data: BlobPart, name: string) {
    return new Blob([data], { type: mimeTypeFromFilename(name) });
}

function mimeTypeFromFilename(name: string): string {
    const lcname = name.toLowerCase();
    if (lcname.endsWith('.wav')) return 'audio/wav';
    if (lcname.endsWith('.ogg')) return 'audio/ogg';
    if (lcname.endsWith('.mp3')) return 'audio/mpeg';
    return '';
}

export function JSZipOptions(): JSZipLoadOptions {
    let opts: JSZipLoadOptions = {};
    if (typeof TextDecoder !== 'undefined')
        opts = {decodeFileName} as JSZipLoadOptions;
    return opts;

    function decodeFileName(bytes: Uint8Array): string {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (err) {
            return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        }
    }
}

export class Deferred<T> {
    public promise: Promise<T>;
    private _resolve!: (value: T) => void;
    private _reject!: (reason?: any) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
    resolve(value: T) {
        this._resolve(value);
    }
    reject(reason?: any) {
        this._reject(reason);
    }
}

export function startMeasure(name: string): () => void {
    let startMark = name + '-start';
    let endMark = name + '-end';
    performance.mark(startMark);
    return () => {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
    };
}

export function gaException(description: any, fatal: boolean = false) {
    let jsonDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return {DOMException: value.name, message: value.message};
        }
        return value;
    });
    gtag('event', 'exception', { description: jsonDescription, fatal });
}

// xsystem35 constants
export enum DRIType {
    SCO = 0,
    CG = 1,
    WAVE = 2,
    MIDI = 3,
    DATA = 4,
    RSC = 5,
    BGM = 6,
}

type AldEntry = { name: string, data: ArrayBuffer }

export function ald_getdata(m: XSystem35Module, type: DRIType, no: number): AldEntry | null {
    let dfile = m._ald_getdata(type, no);
    if (!dfile)
        return null;
    let ptr = m.getValue(dfile + 8, '*');
    let size = m.getValue(dfile, 'i32');
    let name = ascii_to_string(m.getValue(dfile + 12, '*'));  // TODO: Shift_JIS decoding
    let data = m.HEAPU8.buffer.slice(ptr, ptr + size);
    m._ald_freedata(dfile);
    return { name, data };
}

function ascii_to_string(ptr: number): string {
    let str = '';
    while (1) {
        const ch = Module!.HEAPU8[ptr++];
        if (!ch) break;
        str += String.fromCharCode(ch);
    }
    return str;
}

export type EmscriptenOptions = {
    canvas: HTMLCanvasElement;
    print(str: string): void;
    printErr(str: string): void;
    preRun: Array<{ (m: EmscriptenModule): void }>;
    arguments: string[];
};

export type EmscriptenModule = (System3Module | XSystem35Module) & EmscriptenOptions & {
    FS: {
        createPreloadedFile: (
            parent: string,
            name: string,
            url: string,
            canRead: boolean,
            canWrite: boolean,
            onload?: () => void,
            onerror?: () => void,
            dontCreateFile?: boolean,
            canOwn?: boolean,
        ) => void;
    }
};

declare global {
    var Module: EmscriptenModule | undefined;

    // stbvorbis.js
    namespace stbvorbis {
        type DecodeResult = {
            data: Float32Array[],
            sampleRate: number,
            eof: boolean,
            error?: string
        }
        function decode(buf: ArrayBuffer|Uint8Array, callback: (event: DecodeResult) => void): void;
    }
}
