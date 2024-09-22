// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {EmscriptenModule, EmscriptenOptions, $, urlParams, Status} from './util.js';
import {addToast} from './widgets.js';
import * as toolbar from './toolbar.js';
import {message} from './strings.js';

const FontGothic = 'MTLc3m.ttf';
const FontMincho = 'mincho.otf';

let fsReady: (_?: any) => void;
export let fileSystemReady: Promise<any> = new Promise((resolve) => { fsReady = resolve; });
let idbfsReady: (fs: EmscriptenModule['FS']) => void;
export let saveDirReady: Promise<EmscriptenModule['FS']> = new Promise((resolve) => { idbfsReady = resolve; });

export async function loadModule(name: 'system3' | 'xsystem35'): Promise<any> {
    $('#loader').classList.add('module-loading');
    const options: EmscriptenOptions = {
        arguments: [],
        canvas: document.getElementById('canvas') as HTMLCanvasElement,
        print: console.log.bind(console),
        printErr: console.error.bind(console),
        preRun: [
            (m: EmscriptenModule) => {
                window.Module = m;
                m.addRunDependency('gameFiles');
            },
            fsReady,
            function loadFont(m: EmscriptenModule) {
                m.FS.mkdir('/fonts', undefined);
                m.FS.createPreloadedFile('/fonts', FontGothic, 'fonts/' + FontGothic, true, false);
            },
            function prepareSaveDir(m: EmscriptenModule) {
                m.FS.mkdir('/save', undefined);
                m.FS.mount(m.IDBFS, {}, '/save');
                m.FS.mkdir('/patton', undefined);
                m.FS.mount(m.IDBFS, {}, '/patton');
                m.addRunDependency('syncfs');
                m.FS.syncfs(true, (err: any) => {
                    m.removeRunDependency('syncfs');
                    idbfsReady(m.FS);
                });
            }
        ],
    };
    for (let [name, val] of urlParams) {
        if (name.startsWith('-')) {
            options.arguments.push(name);
            if (val)
                options.arguments.push(val);
        }
    }
    try {
        const module_factory = (await (name === 'system3' ? import('./system3.js') : import('./xsystem35.js'))).default;
        module_factory(options);
        await fileSystemReady;
        $('#loader').hidden = true;
        document.body.classList.add('bgblack-fade');
        toolbar.setCloseable();
    } catch (e) {
        gtag('event', 'ModuleLoadFailed', { event_category: 'Game', event_label: name });
        addToast(message.module_load_failed(name), 'error');
    }
}

let fsyncTimer: number | undefined;
export function syncfs(timeout: number) {
    window.clearTimeout(fsyncTimer);
    fsyncTimer = window.setTimeout(() => {
        Module!.FS.syncfs(false, (err: any) => {
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
}

let mincho_loaded = false;
export async function load_mincho_font(): Promise<number> {
    if (mincho_loaded) return Status.OK;
    mincho_loaded = true;

    console.log('loading mincho font');
    try {
        const resp = await fetch('fonts/' + FontMincho);
        const buf = await resp.arrayBuffer();
        Module!.FS.writeFile('/fonts/' + FontMincho, new Uint8Array(buf));
        return Status.OK;
    } catch (e) {
        return Status.NG;
    };
}
