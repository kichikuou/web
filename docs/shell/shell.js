// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, gaException, loadScript, Status } from './util.js';
import './settings.js';
import { syncfs, load_mincho_font } from './moduleloader.js';
import * as zoom from './zoom.js';
import * as cdPlayer from './cdda.js';
import * as audio from './audio.js';
import * as midiPlayer from './midi.js';
import * as texthook from './textlog.js';
import { addToast } from './widgets.js';
import { message } from './strings.js';
class System35Shell {
    constructor() {
        window.onerror = (message, url, line, column, error) => {
            gaException({ type: 'onerror', message, url, line, column }, true);
            addToast('エラーが発生しました。', 'error');
            window.onerror = null;
        };
        window.addEventListener('unhandledrejection', (evt) => {
            let reason = evt.reason;
            console.log(reason);
            if (reason instanceof Error) {
                let { name, message, stack } = reason;
                gaException({ type: 'rejection', name, message, stack }, true);
            }
            else {
                gaException({ type: 'rejection', name: reason.constructor.name, reason }, true);
            }
        });
    }
    windowSizeChanged() {
        zoom.handleZoom();
        zoom.recalcAspectRatio();
    }
    setWindowTitle(title) {
        let colon = title.indexOf(':');
        if (colon !== -1) {
            title = title.slice(colon + 1);
            texthook.setTitle(title);
            $('.navbar-brand').textContent = title;
            ga('set', 'dimension1', title);
            ga('send', 'event', 'Game', 'GameStart', title);
        }
    }
    inputString(title, initialValue, maxLength) {
        title += ' (' + message.input_char_limit(maxLength) + ')';
        let result = window.prompt(title, initialValue);
        if (result) {
            result = result.substring(0, maxLength);
        }
        return result;
    }
    inputNumber(title, min, max, initial) {
        title += ` (${min}-${max})`;
        const s = window.prompt(title, initial + '');
        if (s) {
            const val = parseInt(s);
            if (min <= val && val <= max)
                return val;
        }
        return -1;
    }
    quit() {
        addToast(message.game_over);
        ga('send', 'event', 'Game', 'GameEnd');
        window.onbeforeunload = null;
    }
    syncfs(timeout = 100) {
        syncfs(timeout);
    }
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
let xsystem35 = { Status, shell, cdPlayer, midiPlayer, audio, texthook, load_mincho_font };
window.xsystem35 = xsystem35;
if (typeof WebAssembly !== 'object') {
    document.getElementById('unsupported').hidden = false;
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js');
    });
}
window.addEventListener('beforeinstallprompt', (e) => {
    e.userChoice.then((choiceResult) => {
        ga('send', 'event', 'App', 'InstallPrompt', choiceResult.outcome);
    });
});
