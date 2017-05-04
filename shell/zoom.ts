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
