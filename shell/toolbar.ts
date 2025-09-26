// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';
import {downloadAs} from './widgets.js';
import {message} from './strings.js';

const msgskip_button = $('#msgskip-button');

function init() {
    $('#restart-button').addEventListener('click', restart);
    $('#screenshot-button').addEventListener('click', saveScreenshot);
    msgskip_button.addEventListener('click', toggleMessageSkip);
    document.addEventListener('gamestart', () => {
        document.addEventListener('keydown', keyDownHandler);
    });

    // Unfocus buttons when clicked (to prevent tooltips from remaining visible)
    for (const button of document.querySelectorAll('#toolbar button.tooltip') as NodeListOf<HTMLElement>) {
        button.addEventListener('click', () => button.blur());
    }
}

export function setCloseable() {
    $('#toolbar-handler').addEventListener('click', open);
    $('#toolbar-close-button').addEventListener('click', close);
    $('#toolbar').classList.add('closeable');
    close();
}

function open() {
    $('#toolbar').classList.remove('closed');
}

function close() {
    $('#toolbar').classList.add('closed');
}

function keyDownHandler(e: KeyboardEvent) {
    switch (e.keyCode) {
        case 80: // 'p'
            saveScreenshot();
            break;
        case 82: // 'r'
            restart();
            break;
        case 83: // 's'
            toggleMessageSkip();
            break;
    }
}

export function setSkipButtonState(enabled: number, activated: number) {
    msgskip_button.classList.toggle('disabled', !enabled);
    msgskip_button.classList.toggle('activated', !!activated);
}

function toggleMessageSkip() {
    Module!._msgskip_activate(msgskip_button.classList.contains('activated') ? 0 : 1);
}

function restart() {
    if (window.confirm(message.restart_confirmation)) {
        gtag('event', 'Restart', { event_category: 'Toolbar' });
        Module!._sys_restart();
    }
}

async function saveScreenshot() {
    const name = getScreenshotFilename();
    const ptr = Module!.stringToUTF8OnStack(name);
    if (!Module!._save_screenshot(ptr)) return;
    const content: Uint8Array<ArrayBuffer> = Module!.FS.readFile(name, { encoding: 'binary' });
    Module!.FS.unlink(name);
    const blob = new Blob([content], { type: 'image/bmp' });
    // Without target="_blank", iOS Safari replaces current page
    downloadAs(name, URL.createObjectURL(blob), '_blank');
}

function getScreenshotFilename(): string {
    let now = new Date();
    let MM = ('0' + (now.getMonth() + 1)).slice(-2);
    let DD = ('0' + now.getDate()).slice(-2);
    let hh = ('0' + now.getHours()).slice(-2);
    let mm = ('0' + now.getMinutes()).slice(-2);
    let ss = ('0' + now.getSeconds()).slice(-2);
    return 'Screenshot-' + now.getFullYear() + MM + DD + '-' + hh + mm + ss + '.bmp';
}

init();
