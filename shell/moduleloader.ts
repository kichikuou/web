// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { EmscriptenModule, EmscriptenOptions, $, urlParams } from './util.js';
import { addToast } from './widgets.js';
import * as toolbar from './toolbar.js';
import { message } from './strings.js';

const FontGothic = 'MTLc3m.ttf';
const FontMincho = 'mincho.otf';

let fsReady: (_?: any) => void;
export let fileSystemReady: Promise<any> = new Promise((resolve) => { fsReady = resolve; });
let idbfsReady: (fs: EmscriptenModule['FS']) => void;
export let saveDirReady: Promise<EmscriptenModule['FS']> = new Promise((resolve) => { idbfsReady = resolve; });

// JSPI is used if the browser supports it, otherwise fall back to Asyncify.
// Can be overridden with the `jspi` URL parameter, for debugging.
function useJSPI(): boolean {
    const param = urlParams.get('jspi');
    if (param !== null)
        return param !== '0';
    return typeof (WebAssembly as any).Suspending === 'function';
}

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
    const jspi = useJSPI();
    if (!jspi && !urlParams.has('jspi'))
        gtag('event', 'AsyncifyFallback', { event_category: 'Game', event_label: name });
    try {
        const module_factory = (await (jspi
            ? (name === 'system3' ? import('./jspi/system3.js') : import('./jspi/xsystem35.js'))
            : (name === 'system3' ? import('./system3.js') : import('./xsystem35.js')))).default;
        module_factory(options);
        await fileSystemReady;
        $('#loader').hidden = true;
        document.body.classList.add('bgblack-fade');
        toolbar.setCloseable();
    } catch (e) {
        gtag('event', 'ModuleLoadFailed', { event_category: 'Game', event_label: `${name}${jspi ? '-jspi' : ''}` });
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
export async function load_mincho_font(): Promise<boolean> {
    if (mincho_loaded) return true;
    mincho_loaded = true;

    console.log('loading mincho font');
    try {
        const resp = await fetch('fonts/' + FontMincho);
        const buf = await resp.arrayBuffer();
        Module!.FS.writeFile('/fonts/' + FontMincho, new Uint8Array(buf));
        return true;
    } catch (e) {
        return false;
    };
}
