// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

const $: (selector: string) => HTMLElement = document.querySelector.bind(document);

const JSZIP_SCRIPT = 'lib/jszip.3.1.3.min.js';

const scriptPromises: Map<string, Promise<any>> = new Map();
function loadScript(src: string): Promise<any> {
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

function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as ArrayBuffer); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}

function readFileAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as string); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsText(blob);
    });
}

function ASCIIArrayToString(buffer: Uint8Array): string {
    return String.fromCharCode.apply(null, buffer);
}

function openFileInput(): Promise<File> {
    return new Promise((resolve) => {
        let input = document.createElement('input');
        input.type = 'file';
        input.addEventListener('change', (evt: Event) => {
            document.body.removeChild(input);
            resolve(input.files[0]);
        });
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    });
}

function mkdirIfNotExist(path: string, fs?: typeof FS) {
    try {
        (fs || FS).mkdir(path);
    } catch (err) {
        if (err.errno !== ERRNO_CODES.EEXIST)
            throw err;
    }
}

function isIOSVersionBetween(from: string, to: string): boolean {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return from <= ver && ver < to;
}

function JSZipOptions(): JSZipLoadOptions {
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

function startMeasure(name: string, gaName?: string, gaParam?: string): () => void {
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

function gaException(description: any, exFatal: boolean = false) {
    let exDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return {DOMException: value.name, message: value.message};
        }
        return value;
    });
    ga('send', 'exception', {exDescription, exFatal});
}

namespace xsystem35 {
    export enum Status {
        OK = 0,
        NG = -1,
    }
    export enum Bool {
        FALSE = 0,
        TRUE = 1,
    }
}

// xsystem35 exported functions
declare function _ags_setAntialiasedStringMode(on: number): void;
declare function _ald_getdata(type: number, no: number): number;
declare function _ald_freedata(data: number): void;
declare function _sjis2unicode(byte1: number, byte2: number): void;
declare function _sdl_getDisplaySurface(): number;

declare namespace Module {
    // Undocumented methods / attributes
    let canvas: HTMLCanvasElement;
    function getMemory(size: number): number;
    function setStatus(status: string): void;
    function setWindowTitle(title: string): void;
    function quit(status: number, toThrow: Error): void;
    function readAsync(url: string, onload: (response: any) => void, onerror: () => void): void;
}

declare namespace FS {
    function readFile(path: string, opts?: {encoding?: string; flags?: string}): any;
    function writeFile(path: string, data: ArrayBufferView | string,
                       opts?: {encoding?: string; flags?: string; canOwn?: boolean}): void;
}

declare namespace EmterpreterAsync {
    function handle(asyncOp: (resume: () => void) => void): void;
}

declare var ERRNO_CODES: any;

// https://storage.spec.whatwg.org
interface Navigator {
    storage: StorageManager;
}
interface StorageManager {
    persisted: () => Promise<boolean>;
    persist: () => Promise<boolean>;
    // estimate: () => Promise<StorageEstimate>;
}
