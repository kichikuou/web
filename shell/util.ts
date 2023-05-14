// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

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

export function mkdirIfNotExist(path: string, fs?: typeof FS) {
    try {
        (fs || FS).mkdir(path);
    } catch (err) {
        // ignore EEXIST
    }
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

export function createWaveFile(sampleRate: number, channels: number, dataSize: number, chunks: BlobPart[]): Blob {
    let headerBuf = new ArrayBuffer(44);
    let header = new DataView(headerBuf);
    header.setUint32(0, 0x52494646, false); // 'RIFF'
    header.setUint32(4, dataSize + 36, true); // filesize - 8
    header.setUint32(8, 0x57415645, false); // 'WAVE'
    header.setUint32(12, 0x666D7420, false); // 'fmt '
    header.setUint32(16, 16, true); // size of fmt chunk
    header.setUint16(20, 1, true); // PCM format
    header.setUint16(22, channels, true); // stereo
    header.setUint32(24, sampleRate, true); // sampling rate
    header.setUint32(28, sampleRate * channels * 2, true); // bytes/sec
    header.setUint16(32, channels * 2, true); // block size
    header.setUint16(34, 16, true); // bit/sample
    header.setUint32(36, 0x64617461, false); // 'data'
    header.setUint32(40, dataSize, true); // data size
    chunks.unshift(headerBuf);
    return new Blob(chunks, { type: 'audio/wav' });
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
export enum Status {
    OK = 0,
    NG = -1,
}
export enum Bool {
    FALSE = 0,
    TRUE = 1,
}

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

export function ald_getdata(type: DRIType, no: number): AldEntry | null {
    let dfile = _ald_getdata(type, no);
    if (!dfile)
        return null;
    let ptr = Module.getValue(dfile + 8, '*');
    let size = Module.getValue(dfile, 'i32');
    let name = ascii_to_string(Module.getValue(dfile + 12, '*'));  // TODO: Shift_JIS decoding
    let data = Module.HEAPU8.buffer.slice(ptr, ptr + size);
    _ald_freedata(dfile);
    return { name, data };
}

function ascii_to_string(ptr: number): string {
    let str = '';
    while (1) {
        const ch = Module.HEAPU8[ptr++];
        if (!ch) break;
        str += String.fromCharCode(ch);
    }
    return str;
}

declare global {
    // xsystem35 exported functions
    function _ags_setAntialiasedStringMode(on: number): void;
    function _ald_getdata(type: number, no: number): number;
    function _ald_freedata(data: number): void;
    function _sdl_getDisplaySurface(): number;
    function _audio_callback(ptr: number, len: number): number;
    function _msgskip_activate(enable: number): void;
    function _msgskip_setFlags(flags: number, mask: number): void;
    function _simulate_right_button(pressed: number): void;
    function _sys_restart(): void;
    function _nact_current_page(): number;
    function _nact_current_addr(): number;

    var Module: EmscriptenModule;
    interface EmscriptenModule {
        getValue: typeof getValue;
        addRunDependency: typeof addRunDependency;
        removeRunDependency: typeof removeRunDependency;
        // Undocumented methods / attributes
        canvas: HTMLCanvasElement;
    }
    function setWindowTitle(title: string): void;
    function readAsync(url: string, onload: (response: any) => void, onerror: () => void): void;

    namespace Asyncify {
        function handleSleep(op : (wakeUp: (result: any) => void) => void): void;
    }

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

// https://storage.spec.whatwg.org
interface Navigator {
    storage: StorageManager;
}
interface StorageManager {
    persisted: () => Promise<boolean>;
    persist: () => Promise<boolean>;
    // estimate: () => Promise<StorageEstimate>;
}
