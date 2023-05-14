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
