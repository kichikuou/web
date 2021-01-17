// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, urlParams, readFileAsArrayBuffer, startMeasure, Status} from './util.js';
import {addToast} from './widgets.js';
import * as toolbar from './toolbar.js';
import {message} from './strings.js';

const FontGothic = 'MTLc3m.ttf';
const FontMincho = 'mincho.otf';

let fsReady: (_?: any) => void;
export let fileSystemReady: Promise<any> = new Promise((resolve) => { fsReady = resolve; });
let idbfsReady: (fs: typeof FS) => void;
export let saveDirReady: Promise<typeof FS> = new Promise((resolve) => { idbfsReady = resolve; });

function init() {
    window.Module = {} as EmscriptenModule;
    Module.arguments = [];
    for (let [name, val] of urlParams) {
        if (name.startsWith('-')) {
            Module.arguments.push(name);
            if (val)
                Module.arguments.push(val);
        }
    }
    Module.print = Module.printErr = console.log.bind(console);
    Module.canvas = <HTMLCanvasElement>document.getElementById('canvas');
    Module.preRun = [
        () => { Module.addRunDependency('gameFiles'); },
        fsReady,
        function loadFont() {
            FS.mkdir('/fonts');
            FS.createPreloadedFile('/fonts', FontGothic, 'fonts/' + FontGothic, true, false);
        },
        function prepareSaveDir() {
            FS.mkdir('/save');
            FS.mount(IDBFS, {}, '/save');
            Module.addRunDependency('syncfs');
            FS.syncfs(true, (err) => {
                importSaveDataFromLocalFileSystem().then(() => {
                    Module.removeRunDependency('syncfs');
                    idbfsReady(FS);
                });
            });
        },
        () => {
            // Don't let emscripten change the window title.
            // Must be overwritten after the emscripten module is evaluated.
            window.setWindowTitle = () => {};
        }
    ];
}

export function loadModule(name: 'system3' | 'xsystem35'): Promise<any> {
    $('#loader').classList.add('module-loading');
    let src = name + '.js';
    let script = document.createElement('script');
    script.src = src;
    script.onerror = () => {
        ga('send', 'event', 'Game', 'ModuleLoadFailed', src);
        addToast(message.module_load_failed(src), 'error');
    };
    document.body.appendChild(script);
    let endMeasure = startMeasure('ModuleLoad', 'Module load', src);
    return fileSystemReady.then(() => {
        endMeasure();
        $('#loader').hidden = true;
        document.body.classList.add('bgblack-fade');
        toolbar.setCloseable();
    });
}

let fsyncTimer: number | undefined;
export function syncfs(timeout: number) {
    window.clearTimeout(fsyncTimer);
    fsyncTimer = window.setTimeout(() => {
        FS.syncfs(false, (err) => {
            if (err)
                console.log('FS.syncfs error: ', err);
        });
    }, timeout);
    persistStorage();
}

let persistRequested = false;
async function persistStorage() {
    if (persistRequested || !(navigator.storage && navigator.storage.persist))
        return;
    persistRequested = true;
    if (await navigator.storage.persisted())
        return;
    let result = await navigator.storage.persist();
    ga('send', 'event', 'Game', 'StoragePersist', result ? 'granted' : 'refused');
}

let mincho_loaded = false;
export function load_mincho_font(): Promise<number> {
    if (mincho_loaded)
        return Promise.resolve(Status.OK);
    mincho_loaded = true;

    return new Promise((resolve) => {
        console.log('loading mincho font');
        let endMeasure = startMeasure('FontLoad', 'Font load', FontMincho);
        readAsync('fonts/' + FontMincho, (buf: ArrayBuffer) => {
            endMeasure();
            FS.writeFile('/fonts/' + FontMincho, new Uint8Array(buf));
            resolve(Status.OK);
        }, () => {
            resolve(Status.NG);
        });
    });
}

async function importSaveDataFromLocalFileSystem() {
    function requestFileSystem(type: number, size: number): Promise<FileSystem> {
        return new Promise((resolve, reject) => window.webkitRequestFileSystem(type, size, resolve, reject));
    }
    function getDirectory(dir: DirectoryEntry, path: string): Promise<DirectoryEntry> {
        return new Promise((resolve, reject) => dir.getDirectory(path, {}, resolve, reject));
    }
    function readEntries(reader: DirectoryReader): Promise<Entry[]> {
        return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    }
    function fileOf(entry: FileEntry): Promise<File> {
        return new Promise((resolve, reject) => entry.file(resolve, reject));
    }

    if (FS.readdir('/save').length > 2)  // Are there any entries other than . and ..?
        return;
    if (!window.webkitRequestFileSystem)
        return;
    try {
        let fs = await requestFileSystem(self.PERSISTENT, 0);
        let savedir = (await getDirectory(fs.root, 'save')).createReader();
        let entries: FileEntry[] = [];
        while (true) {
            let results = await readEntries(savedir);
            if (!results.length)
                break;
            for (let e of results) {
                if (e.isFile && e.name.toLowerCase().endsWith('.asd'))
                    entries.push(e as FileEntry);
            }
        }
        if (entries.length && window.confirm(message.import_savedata_confirm)) {
            for (let e of entries) {
                let content = await readFileAsArrayBuffer(await fileOf(e));
                FS.writeFile('/save/' + e.name, new Uint8Array(content));
            }
            syncfs(0);
            ga('send', 'event', 'Game', 'SaveDataImported');
        }
    } catch (err) {
    }
}

// Workaround for Safari 13 bug (?) where WebAssembly.instantiate() replaces window.Module
const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = function(bytes: any, importObject: any) {
    const originalModule = Module;
    return originalInstantiate.call(this, bytes, importObject).then((obj: any) => {
        if (Module !== originalModule)
            ga('send', 'event', 'Loader', 'InstantiateBug');
        Module = originalModule;
        return obj;
    });
};

init();
