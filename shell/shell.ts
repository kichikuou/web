// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, gaException, Status} from './util.js';
import './settings.js';
import './loader.js';
import {syncfs, load_mincho_font} from './moduleloader.js';
import * as zoom from './zoom.js';
import * as cdPlayer from './cdda.js';
import * as audio from './audio.js';
import * as midiPlayer from './midi.js';
import * as toolbar from './toolbar.js';
import * as texthook from './textlog.js';
import {addToast} from './widgets.js';
import {message} from './strings.js';
import {config} from './config.js';

class System35Shell {
    constructor() {
        const message_ = message;
        window.onerror = (message, url, line, column, error) => {
            const address = scenario_address();
            gaException({type: 'onerror', message, url, line, column, address}, true);
            addToast(message_.error_occurred, 'error');
            window.onerror = null;
        };
        window.addEventListener('unhandledrejection', (evt: any) => {
            const reason = evt.reason;
            const address = scenario_address();
            console.log(address, reason);
            if (reason instanceof Error) {
                let {name, message, stack} = reason;
                gaException({type: 'rejection', name, message, stack, address}, true);
                if (name === 'RuntimeError') {
                    addToast(message_.error_occurred, 'error');
                }
            } else {
                gaException({type: 'rejection', name: reason.constructor.name, reason, address}, true);
            }
        });
    }

    windowSizeChanged() {
        zoom.handleZoom();
        zoom.recalcAspectRatio();
    }

    setWindowTitle(title: string) {
        let colon = title.indexOf(':');
        if (colon !== -1) {
            title = title.slice(colon + 1).trim();
            texthook.setTitle(title);
            $('.navbar-brand').textContent = title;
            gtag('event', 'GameStart', { GameTitle: title, event_category: 'Game', event_label: title });
        }
    }

    showMouseMoveEffect(x: number, y: number) {
        const canvas = <HTMLCanvasElement>$('#canvas');
        const rect = canvas.getBoundingClientRect();
        const size = 32;
        const xx = rect.left + (x * rect.width / canvas.width) - size / 2;
        const yy = rect.top + (y * rect.height / canvas.height) - size / 2;
        const ripple = document.createElement('div');

        ripple.classList.add('ripple');
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${xx}px`;
        ripple.style.top = `${yy}px`;

        document.body.appendChild(ripple);

        ripple.addEventListener('animationend', function() {
            ripple.parentElement?.removeChild(ripple);
        });
    }

    inputString(title: string, initialValue: string, maxLength: number): string | null {
        title += ' (' + message.input_char_limit(maxLength) + ')';
        let result = window.prompt(title, initialValue);
        if (result) {
            result = result.substring(0, maxLength);
        }
        return result;
    }

    inputNumber(title: string, min: number, max: number, initial: number): number {
        title += ` (${min}-${max})`;
        const s = window.prompt(title, initial + '');
        if (s) {
            const val = parseInt(s);
            if (min <= val && val <= max)
                return val;
        }
        return -1;
    }

    setSkipButtonState(enabled: number, activated: number) {
        toolbar.setSkipButtonState(enabled, activated);
    }

    quit() {
        addToast(message.game_over);
        gtag('event', 'GameEnd', { event_category: 'Game' });
        window.onbeforeunload = null;
    }

    syncfs(timeout = 100) {
        syncfs(timeout);
    }

    onExit(code: number): number {
        if (code === 2 && $('.navbar-brand').textContent === 'アリスの館3') {
            launchPatton();
            return -1; // NACT_HALT
        } else if (code >= 0) {
            // Restarts the game instead of exiting.
            return -2; // NACT_RESTART
        }
        return code;
    }
}

function scenario_address(): string | undefined {
    if (!window['_nact_current_page']) return undefined;
    return _nact_current_page() + ':' + _nact_current_addr().toString(16);
}

let shell = new System35Shell();

let xsystem35 = {Status, shell, cdPlayer, midiPlayer, audio, texthook, load_mincho_font};
(window as any).xsystem35 = xsystem35;

if (typeof WebAssembly !== 'object') {
    document.getElementById('unsupported')!.hidden = false;
}

document.addEventListener('gamestart', () => {
    let container = $('#xsystem35');
    container.addEventListener('touchstart', (e) => {
        if (e.target === container) {
            _simulate_right_button(1);
        }
    });
    container.addEventListener('touchend', (e) => {
        if (e.target === container) {
            _simulate_right_button(0);
        }
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js');
    });
}

window.addEventListener('beforeinstallprompt', (e: any) => {
    e.userChoice.then((choiceResult: any) => {
        gtag('event', 'InstallPrompt', { event_category: 'App', event_label: choiceResult.outcome });
    });
});

async function launchPatton() {
    FS.mkdir('/patton');
    FS.mount(IDBFS, {}, '/patton');
    await new Promise((resolve) => FS.syncfs(true, resolve));
    try {
        FS.stat('/patton/patton.nhd');
        // The HD image already exists, no preparation is needed.
    } catch (_) {
        // Store the game files to IDBFS.
        for (const fname of FS.readdir('/')) {
            if (FS.isDir(FS.stat(fname).mode)) {
                continue;
            }
            const content = FS.readFile(fname);
            FS.writeFile('/patton/' + fname, content);
        }
        const err = await new Promise((resolve) => FS.syncfs(false, resolve));
        if (err) throw err;
    }
    FS.unmount('/patton');
    FS.rmdir('/patton');
    config.unloadConfirmation = false;
    window.location.href = '/patton/';  // Patton GO!
    setTimeout(_sys_restart, 1000);
}
