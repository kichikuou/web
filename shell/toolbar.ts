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
    _msgskip_activate(msgskip_button.classList.contains('activated') ? 0 : 1);
}

function restart() {
    if (window.confirm(message.restart_confirmation)) {
        ga('send', 'event', 'Toolbar', 'Restart');
        _sys_restart();
    }
}

async function saveScreenshot() {
    let pixels = _sdl_getDisplaySurface();
    let canvas = document.createElement('canvas');
    canvas.width = Module.canvas.width;
    canvas.height = Module.canvas.height;
    let ctx = canvas.getContext('2d')!;
    let image = ctx.createImageData(canvas.width, canvas.height);
    let buffer = image.data;
    let num = image.data.length;
    for (let dst = 0; dst < num; dst += 4) {
        buffer[dst] = Module.HEAPU8[pixels + 2];
        buffer[dst + 1] = Module.HEAPU8[pixels + 1];
        buffer[dst + 2] = Module.HEAPU8[pixels];
        buffer[dst + 3] = 0xff;
        pixels += 4;
    }
    ctx.putImageData(image, 0, 0);

    let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve));
    if (!blob) return;
    // Unless target="_blank", iOS safari replaces current page
    downloadAs(getScreenshotFilename(), URL.createObjectURL(blob), '_blank');
}

function getScreenshotFilename(): string {
    let now = new Date();
    let MM = ('0' + (now.getMonth() + 1)).slice(-2);
    let DD = ('0' + now.getDate()).slice(-2);
    let hh = ('0' + now.getHours()).slice(-2);
    let mm = ('0' + now.getMinutes()).slice(-2);
    let ss = ('0' + now.getSeconds()).slice(-2);
    return 'Screenshot-' + now.getFullYear() + MM + DD + '-' + hh + mm + ss + '.png';
}

init();
