// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, fsReady, idbfsReady, urlParams, gaException, startMeasure, readFileAsArrayBuffer, loadScript, Status} from './util.js';
import './settings.js';
import * as zoom from './zoom.js';
import * as cdPlayer from './cdda.js';
import * as audio from './audio.js';
import * as midiPlayer from './midi.js';
import * as texthook from './textlog.js';
import {addToast} from './widgets.js';

const FontGothic = 'MTLc3m.ttf';
const FontMincho = 'mincho.otf';

class System35Shell {
    constructor() {
        this.initModule();

        window.onerror = (message, url, line, column, error) => {
            gaException({type: 'onerror', message, url, line, column}, true);
            addToast('エラーが発生しました。', 'error');
            window.onerror = null;
        };
        window.addEventListener('unhandledrejection', (evt: any) => {
            let reason = evt.reason;
            console.log(reason);
            if (reason instanceof Error) {
                let {name, message, stack} = reason;
                gaException({type: 'rejection', name, message, stack}, true);
            } else {
                gaException({type: 'rejection', name: reason.constructor.name, reason}, true);
            }
            // this.addToast('エラーが発生しました。', 'error');
        });
    }

    private initModule() {
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
                FS.createPreloadedFile('/', FontGothic, 'fonts/' + FontGothic, true, false);
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
                Module.setWindowTitle = () => {};
            }
        ];
    }

    windowSizeChanged() {
        zoom.handleZoom();
        zoom.recalcAspectRatio();
    }

    setWindowTitle(title: string) {
        let colon = title.indexOf(':');
        if (colon !== -1) {
            title = title.slice(colon + 1);
            texthook.setTitle(title);
            $('.navbar-brand').textContent = title;
            ga('set', 'dimension1', title);
            ga('send', 'event', 'Game', 'GameStart', title);
        }
    }

    inputString(title: string, initialValue: string, maxLength: number): string | null {
        title += ' (全角' + maxLength + '文字まで)';
        let result = window.prompt(title, initialValue);
        if (result) {
            result = result.substring(0, maxLength);
        }
        return result;
    }

    quit() {
        addToast('終了しました。');
        ga('send', 'event', 'Game', 'GameEnd');
        window.onbeforeunload = null;
    }

    private fsyncTimer: number | undefined;
    syncfs(timeout = 100) {
        window.clearTimeout(this.fsyncTimer);
        this.fsyncTimer = window.setTimeout(() => {
            FS.syncfs(false, (err) => {
                if (err)
                    console.log('FS.syncfs error: ', err);
            });
        }, timeout);
        this.persistStorage();
    }

    private persistRequested = false;
    async persistStorage() {
        if (this.persistRequested || !(navigator.storage && navigator.storage.persist))
            return;
        this.persistRequested = true;
        if (await navigator.storage.persisted())
            return;
        let result = await navigator.storage.persist();
        ga('send', 'event', 'Game', 'StoragePersist', result ? 'granted' : 'refused');
    }
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
        if (entries.length && window.confirm('鬼畜王 on Chrome のセーブデータを引き継ぎますか?')) {
            for (let e of entries) {
                let content = await readFileAsArrayBuffer(await fileOf(e));
                FS.writeFile('/save/' + e.name, new Uint8Array(content));
            }
            shell.syncfs(0);
            ga('send', 'event', 'Game', 'SaveDataImported');
        }
    } catch (err) {
    }
}

let mincho_loaded = false;
function load_mincho_font(): Promise<number> {
    if (mincho_loaded)
        return Promise.resolve(Status.OK);
    mincho_loaded = true;

    return new Promise((resolve) => {
        console.log('loading mincho font');
        let endMeasure = startMeasure('FontLoad', 'Font load', FontMincho);
        readAsync('fonts/' + FontMincho, (buf: ArrayBuffer) => {
            endMeasure();
            FS.writeFile(FontMincho, new Uint8Array(buf));
            resolve(Status.OK);
        }, () => {
            resolve(Status.NG);
        });
    });
}

function loadPolyfills() {
    if (typeof TextDecoder === 'undefined') {
        const scripts = [
            'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding-indexes.js',
            'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding.js'
        ];
        for (let src of scripts)
            loadScript(src);
    }
}
window.addEventListener('load', loadPolyfills);

let shell = new System35Shell();

let xsystem35 = {Status, shell, cdPlayer, midiPlayer, audio, texthook, load_mincho_font};
(window as any).xsystem35 = xsystem35;

if (typeof WebAssembly !== 'object') {
    document.getElementById('unsupported')!.hidden = false;
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js');
    });
}

window.addEventListener('beforeinstallprompt', (e: any) => {
    e.userChoice.then((choiceResult: any) => {
        ga('send', 'event', 'App', 'InstallPrompt', choiceResult.outcome);
    });
});
