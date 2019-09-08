// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';
import {config} from './config.js';

const canvas = <HTMLCanvasElement>$('#canvas');
const zoomSelect = <HTMLInputElement>$('#zoom');
const pixelateCheckbox = <HTMLInputElement>$('#pixelate');
let throttling = false;

function init() {
    zoomSelect.addEventListener('change', handleZoom);
    zoomSelect.value = config.zoom;
    if (CSS.supports('image-rendering', 'pixelated') || CSS.supports('image-rendering', '-moz-crisp-edges')) {
        pixelateCheckbox.addEventListener('change', handlePixelate);
        if (config.pixelate) {
            pixelateCheckbox.checked = true;
            handlePixelate();
        }
    } else {
        pixelateCheckbox.setAttribute('disabled', 'true');
    }
    if (screen.orientation) {
        screen.orientation.addEventListener('change', () => {
            if (screen.orientation.type.startsWith('landscape'))
                requestFullscreen();
            else
                exitFullscreen();
        });
    }
    window.addEventListener('resize', onResize);
}

export function handleZoom() {
    let value = zoomSelect.value;
    config.zoom = value;
    config.persist();
    let navbarStyle = $('.navbar').style;
    if (value === 'fit') {
        $('#xsystem35').classList.add('fit');
        navbarStyle.maxWidth = 'none';
        canvas.style.width = null;
    } else {
        $('#xsystem35').classList.remove('fit');
        let ratio = Number(value);
        navbarStyle.maxWidth = canvas.style.width = canvas.width * ratio + 'px';
    }
}

function onResize() {
    if (throttling)
        return;
    throttling = true;
    window.requestAnimationFrame(() => {
        recalcAspectRatio();
        throttling = false;
    });
}

export function recalcAspectRatio() {
    let container = $('.contents');
    let target = $('#xsystem35');
    let containerAspect = container.offsetWidth / container.offsetHeight;
    if (!containerAspect)
        return;
    let canvasAspect = canvas.width / canvas.height;
    if (containerAspect < canvasAspect) {
        target.classList.add('letterbox');
        target.classList.remove('pillarbox');
    } else {
        target.classList.remove('letterbox');
        target.classList.add('pillarbox');
    }
}

function handlePixelate() {
    config.pixelate = pixelateCheckbox.checked;
    config.persist();
    if (pixelateCheckbox.checked)
        canvas.classList.add('pixelated');
    else
        canvas.classList.remove('pixelated');
}

function requestFullscreen() {
    let e = document.documentElement;
    if (e.requestFullscreen)
        e.requestFullscreen();
    else if ((e as any).webkitRequestFullScreen)
        (e as any).webkitRequestFullScreen();
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        if ((document as any).fullscreenElement)
            document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
        if ((document as any).webkitFullscreenElement)
            (document as any).webkitExitFullscreen();
    }
}

init();
