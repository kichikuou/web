// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
export const $ = document.querySelector.bind(document);
export const urlParams = new URLSearchParams(location.search.slice(1));
export const JSZIP_SCRIPT = 'lib/jszip.3.1.3.min.js';
const scriptPromises = new Map();
export function loadScript(src) {
    let p = scriptPromises.get(src);
    if (!p) {
        let e = document.createElement('script');
        e.src = src;
        p = new Promise((resolve, reject) => {
            e.addEventListener('load', resolve, { once: true });
            e.addEventListener('error', reject, { once: true });
        });
        document.body.appendChild(e);
        scriptPromises.set(src, p);
    }
    return p;
}
export function readFileAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}
export function readFileAsText(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsText(blob);
    });
}
export function mkdirIfNotExist(path, fs) {
    try {
        (fs || FS).mkdir(path);
    }
    catch (err) {
        // ignore EEXIST
    }
}
export function isMobileSafari(from, to) {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return (!from || from <= ver) && (!to || ver < to);
}
export function JSZipOptions() {
    let opts = {};
    if (typeof TextDecoder !== 'undefined')
        opts = { decodeFileName };
    return opts;
    function decodeFileName(bytes) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        catch (err) {
            return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        }
    }
}
export function startMeasure(name, gaName, gaParam) {
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
export function gaException(description, exFatal = false) {
    let exDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return { DOMException: value.name, message: value.message };
        }
        return value;
    });
    ga('send', 'exception', { exDescription, exFatal });
}
// xsystem35 constants
export var Status;
(function (Status) {
    Status[Status["OK"] = 0] = "OK";
    Status[Status["NG"] = -1] = "NG";
})(Status || (Status = {}));
export var Bool;
(function (Bool) {
    Bool[Bool["FALSE"] = 0] = "FALSE";
    Bool[Bool["TRUE"] = 1] = "TRUE";
})(Bool || (Bool = {}));
export function supportsWorkerType() {
    let supports = false;
    const tester = {
        get type() { supports = true; return 'module'; }
    };
    try {
        const worker = new Worker('data:,', tester);
        worker.terminate();
    }
    finally {
        return supports;
    }
}
