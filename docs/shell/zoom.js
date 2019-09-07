// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
class ZoomManager {
    constructor() {
        this.canvas = $('#canvas');
        this.zoomSelect = $('#zoom');
        this.pixelateCheckbox = $('#pixelate');
        this.throttling = false;
        this.zoomSelect.addEventListener('change', this.handleZoom.bind(this));
        this.zoomSelect.value = config.zoom;
        if (CSS.supports('image-rendering', 'pixelated') || CSS.supports('image-rendering', '-moz-crisp-edges')) {
            this.pixelateCheckbox.addEventListener('change', this.handlePixelate.bind(this));
            if (config.pixelate) {
                this.pixelateCheckbox.checked = true;
                this.handlePixelate();
            }
        }
        else {
            this.pixelateCheckbox.setAttribute('disabled', 'true');
        }
        if (screen.orientation) {
            screen.orientation.addEventListener('change', () => {
                if (screen.orientation.type.startsWith('landscape'))
                    this.requestFullscreen();
                else
                    this.exitFullscreen();
            });
        }
        window.addEventListener('resize', this.onResize.bind(this));
    }
    handleZoom() {
        let value = this.zoomSelect.value;
        config.zoom = value;
        config.persist();
        let navbarStyle = $('.navbar').style;
        if (value === 'fit') {
            $('#xsystem35').classList.add('fit');
            navbarStyle.maxWidth = 'none';
            this.canvas.style.width = null;
        }
        else {
            $('#xsystem35').classList.remove('fit');
            let ratio = Number(value);
            navbarStyle.maxWidth = this.canvas.style.width = this.canvas.width * ratio + 'px';
        }
    }
    onResize() {
        if (this.throttling)
            return;
        this.throttling = true;
        window.requestAnimationFrame(() => {
            this.recalcAspectRatio();
            this.throttling = false;
        });
    }
    recalcAspectRatio() {
        let container = $('.contents');
        let target = $('#xsystem35');
        let containerAspect = container.offsetWidth / container.offsetHeight;
        if (!containerAspect)
            return;
        let canvasAspect = this.canvas.width / this.canvas.height;
        if (containerAspect < canvasAspect) {
            target.classList.add('letterbox');
            target.classList.remove('pillarbox');
        }
        else {
            target.classList.remove('letterbox');
            target.classList.add('pillarbox');
        }
    }
    handlePixelate() {
        config.pixelate = this.pixelateCheckbox.checked;
        config.persist();
        if (this.pixelateCheckbox.checked)
            this.canvas.classList.add('pixelated');
        else
            this.canvas.classList.remove('pixelated');
    }
    requestFullscreen() {
        let e = document.documentElement;
        if (e.requestFullscreen)
            e.requestFullscreen();
        else if (e.webkitRequestFullScreen)
            e.webkitRequestFullScreen();
    }
    exitFullscreen() {
        if (document.exitFullscreen) {
            if (document.fullscreenElement)
                document.exitFullscreen();
        }
        else if (document.webkitExitFullscreen) {
            if (document.webkitFullscreenElement)
                document.webkitExitFullscreen();
        }
    }
}
export let zoom = new ZoomManager();
