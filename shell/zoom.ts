// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />
/// <reference path="config.ts" />

interface Screen {
    orientation: {type: string} & EventTarget;
}

namespace xsystem35 {
    export class ZoomManager {
        private canvas = <HTMLCanvasElement>$('#canvas');
        private zoomSelect = <HTMLInputElement>$('#zoom');
        private pixelateCheckbox = <HTMLInputElement>$('#pixelate');
        private throttling = false;

        constructor() {
            this.zoomSelect.addEventListener('change', this.handleZoom.bind(this));
            this.zoomSelect.value = config.zoom;
            if (CSS.supports('image-rendering', 'pixelated') || CSS.supports('image-rendering', '-moz-crisp-edges')) {
                this.pixelateCheckbox.addEventListener('change', this.handlePixelate.bind(this));
                if (config.pixelate) {
                    this.pixelateCheckbox.checked = true;
                    this.handlePixelate();
                }
            } else {
                this.pixelateCheckbox.setAttribute('disabled', 'true');
            }
            if (screen.orientation && document.webkitExitFullscreen) {
                screen.orientation.addEventListener('change', () => {
                    if (screen.orientation.type.startsWith('landscape'))
                        document.documentElement.webkitRequestFullScreen();
                    else
                        document.webkitExitFullscreen();
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
            } else {
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
            let container = $('#xsystem35');
            let containerAspect = container.offsetWidth / container.offsetHeight;
            if (!containerAspect)
                return;
            let canvasAspect = this.canvas.width / this.canvas.height;
            if (containerAspect < canvasAspect) {
                container.classList.add('letterbox');
                container.classList.remove('pillarbox');
            } else {
                container.classList.remove('letterbox');
                container.classList.add('pillarbox');
            }
        }

        private handlePixelate() {
            config.pixelate = this.pixelateCheckbox.checked;
            config.persist();
            if (this.pixelateCheckbox.checked)
                this.canvas.classList.add('pixelated');
            else
                this.canvas.classList.remove('pixelated');
        }
    }
}
