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

export function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as ArrayBuffer); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}

export function readFileAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as string); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsText(blob);
    });
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

export function startMeasure(name: string, gaName?: string, gaParam?: string): () => void {
    let startMark = name + '-start';
    let endMark = name + '-end';
    performance.mark(startMark);
    return () => {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        if (gaName) {
            let duration = performance.getEntriesByName(name)[0].duration;
            ga('send', 'timing', gaName, gaParam, Math.round(duration));
        }
    };
}

export function gaException(description: any, exFatal: boolean = false) {
    let exDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return {DOMException: value.name, message: value.message};
        }
        return value;
    });
    ga('send', 'exception', {exDescription, exFatal});
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

declare global {
    // xsystem35 exported functions
    function _ags_setAntialiasedStringMode(on: number): void;
    function _ald_getdata(type: number, no: number): number;
    function _ald_freedata(data: number): void;
    function _sdl_getDisplaySurface(): number;
    function _audio_callback(ptr: number, len: number): number;
    function _msgskip_activate(enable: number): void;
    function _msgskip_setFlags(flags: number, mask: number): void;

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
