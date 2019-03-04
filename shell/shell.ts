// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />
/// <reference path="config.ts" />
/// <reference path="loader.ts" />
/// <reference path="fileloader.ts" />
/// <reference path="settings.ts" />
/// <reference path="zoom.ts" />
/// <reference path="volume.ts" />
/// <reference path="cdda.ts" />
/// <reference path="midi.ts" />
/// <reference path="audio.ts" />
/// <reference path="toolbar.ts" />

namespace xsystem35 {
    const FontGothic = 'MTLc3m.ttf';
    const FontMincho = 'mincho.otf';
    export const xsys35rc = [
        'font_device: ttf',
        'ttfont_mincho: ' + FontMincho,
        'ttfont_gothic: ' + FontGothic, '',
    ].join('\n');
    export let fileSystemReady: Promise<any>;
    export let saveDirReady: Promise<typeof FS>;
    export let cdPlayer: CDPlayer;
    export let midiPlayer: MIDIPlayer;
    export let audio: AudioManager;
    export let settings: Settings;

    export class System35Shell {
        private params: URLSearchParams & Map<string, string>;
        private loader: Loader;
        status: HTMLElement = document.getElementById('status');
        private zoom: ZoomManager;
        private volumeControl: VolumeControl;
        private toolbar: ToolBar;

        constructor() {
            this.parseParams(location.search.slice(1));
            this.initModule();

            window.onerror = (message, url, line, column, error) => {
                gaException({type: 'onerror', message, url, line, column}, true);
                this.addToast('エラーが発生しました。', 'error');
                window.onerror = null;
            };
            // Chrome only
            window.addEventListener('unhandledrejection', (evt: any) => {
                let err: Error = evt.reason;
                console.log(err);
                let {message, stack} = err;
                gaException({type: 'rejection', message, stack}, true);
                // this.addToast('エラーが発生しました。', 'error');
            });

            if (this.params.get('loader') === 'file')
                this.loader = new FileLoader();
            else
                this.loader = new ImageLoader(this);
            this.volumeControl = new VolumeControl();
            xsystem35.cdPlayer = new CDPlayer(this.loader, this.volumeControl);
            this.zoom = new ZoomManager();
            this.toolbar = new ToolBar();
            xsystem35.audio = new AudioManager(this.volumeControl);
            xsystem35.settings = new Settings();
        }

        private parseParams(searchParams: string) {
            if (typeof URLSearchParams !== 'undefined') {
                this.params = <URLSearchParams & Map<string, string>>new URLSearchParams(searchParams);
                return;
            }
            // For Edge
            this.params = <URLSearchParams & Map<string, string>>new Map();
            if (window.location.search.length > 1) {
                for (let item of searchParams.split('&')) {
                    let [key, value] = item.split('=');
                    this.params.set(key, value);
                }
            }
        }

        private initModule() {
            let fsReady: () => void;
            fileSystemReady = new Promise((resolve) => { fsReady = resolve; });
            let idbfsReady: (fs: typeof FS) => void;
            saveDirReady = new Promise((resolve) => { idbfsReady = resolve; });

            Module.arguments = [];
            for (let [name, val] of this.params) {
                if (name.startsWith('-')) {
                    Module.arguments.push(name);
                    if (val)
                        Module.arguments.push(val);
                }
            }
            Module.print = Module.printErr = console.log.bind(console);
            Module.setWindowTitle = (title) => {
                let colon = title.indexOf(':');
                if (colon !== -1) {
                    title = title.slice(colon + 1);
                    $('.navbar-brand').textContent = title;
                    ga('set', 'dimension1', title);
                    ga('send', 'event', 'Game', 'GameStart', title);
                }
            };
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
            ];
        }

        loadModule(name: 'system3' | 'xsystem35'): Promise<any> {
            let src = name + (this.shouldUseWasm() ? '.js' : '.asm.js');
            let script = document.createElement('script');
            script.src = src;
            script.onerror = () => {
                ga('send', 'event', 'Game', 'ModuleLoadFailed', src);
                this.addToast(src + 'の読み込みに失敗しました。リロードしてください。', 'error');
            };
            document.body.appendChild(script);
            let start = performance.now();
            return xsystem35.fileSystemReady.then(() => {
                ga('send', 'timing', 'Module load', src, Math.round(performance.now() - start));
                $('#loader').hidden = true;
                document.body.classList.add('bgblack-fade');
                this.toolbar.setCloseable();
            });
        }

        private shouldUseWasm(): boolean {
            if (typeof WebAssembly !== 'object')
                return false;
            let param = this.params.get('wasm');
            if (param)
                return param !== '0';
            if (isIOSVersionBetween('11.2.2', '11.3')) {
                // Disable wasm on iOS 11.2.[2-] to workaround WebKit bug
                // https://bugs.webkit.org/show_bug.cgi?id=181781
                ga('send', 'event', 'Game', 'WasmDisabled');
                return false;
            }
            return true;
        }

        loaded() {
            if (this.loader.hasMidi)
                xsystem35.midiPlayer = new MIDIPlayer(this.volumeControl);
            xsystem35.audio.init();
            $('#xsystem35').hidden = false;
            document.body.classList.add('game');
            $('#toolbar').classList.remove('before-game-start');
            window.onbeforeunload = this.onBeforeUnload.bind(this);
            setTimeout(() => {
                if (config.antialias)
                    Module.arguments.push('-antialias');
                Module.removeRunDependency('gameFiles');
            }, 0);
        }

        onBeforeUnload(e: BeforeUnloadEvent) {
            if (config.unloadConfirmation)
                e.returnValue = 'セーブしていないデータは失われます。';
        }

        windowSizeChanged() {
            this.zoom.handleZoom();
            this.zoom.recalcAspectRatio();
        }

        inputString(title: string, initialValue: string, maxLength: number): string {
            title += ' (全角' + maxLength + '文字まで)';
            let result = window.prompt(title, initialValue);
            if (result) {
                result = result.substring(0, maxLength);
            }
            return result;
        }

        quit() {
            this.addToast('終了しました。');
            ga('send', 'event', 'Game', 'GameEnd');
            window.onbeforeunload = null;
        }

        addToast(msg: string | Node, type?: 'success' | 'warning' | 'error'): HTMLElement {
            let container = $('.toast-container');
            let div = document.createElement('div');
            div.classList.add('toast');
            if (type)
                div.classList.add('toast-' + type);
            if (typeof msg === 'string')
                div.innerText = msg;
            else
                div.appendChild(msg);
            let btn = document.createElement('button');
            btn.setAttribute('class', 'btn btn-clear float-right');
            function dismiss() { if (div.parentNode === container) container.removeChild(div); }
            btn.addEventListener('click', dismiss);
            let timeout = type ? {success: 5000, warning: 10000, error: null}[type] : 5000;
            if (timeout)
                setTimeout(dismiss, timeout);
            div.insertBefore(btn, div.firstChild);
            container.insertBefore(div, container.firstChild);
            return div;
        }

        private fsyncTimer: number;
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

    export async function importSaveDataFromLocalFileSystem() {
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
                    FS.writeFile('/save/' + e.name, new Uint8Array(content), { encoding: 'binary' });
                }
                shell.syncfs(0);
                ga('send', 'event', 'Game', 'SaveDataImported');
            }
        } catch (err) {
        }
    }

    let mincho_loaded = false;
    export function load_mincho_font(): Promise<number> {
        if (mincho_loaded)
            return Promise.resolve(Status.OK);
        mincho_loaded = true;

        return new Promise((resolve) => {
            console.log('loading mincho font');
            let start = performance.now();
            Module.readAsync('fonts/' + FontMincho, (buf: ArrayBuffer) => {
                ga('send', 'timing', 'Font load', FontMincho, Math.round(performance.now() - start));
                FS.writeFile(FontMincho, new Uint8Array(buf), { encoding: 'binary' });
                resolve(Status.OK);
            }, () => {
                resolve(Status.NG);
            });
        });
    }

    export function loadPolyfills() {
        if (typeof TextDecoder === 'undefined') {
            const scripts = [
                'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding-indexes.js',
                'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding.js'
            ];
            for (let src of scripts) {
                let e = document.createElement('script');
                e.src = src;
                e.async = true;
                document.body.appendChild(e);
            }
        }
    }
    window.addEventListener('load', loadPolyfills);

    export let shell = new System35Shell();
}
