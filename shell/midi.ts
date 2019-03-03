// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

declare class Timidity {
    constructor(baseurl?: string);
    load(urlOrBuf: string | Uint8Array): void;
    play(): void;
    pause(): void;
    on(event: string, callback: () => void): void;
    currentTime: number;
    _audioContext: AudioContext;
}

namespace xsystem35 {
    declare var webkitAudioContext: any;
    export class MIDIPlayer {
        private timidity: Timidity;
        private loop: number;

        constructor() {
            Module.addRunDependency('timidity');
            let script = document.createElement('script');
            script.src = '/timidity/timidity.js';
            script.onload = () => {
                Module.removeRunDependency('timidity');
                this.timidity = new Timidity('/timidity/');
                this.timidity.on('error', this.onError.bind(this));
                this.timidity.on('ended', this.onEnd.bind(this));
                this.removeSafariGestureRestriction();
            }
            document.body.appendChild(script);
        }

        play(loop: number, data: number, datalen: number) {
            this.timidity.load(Module.HEAPU8.subarray(data, data + datalen));
            this.timidity.play();
            this.loop = loop;
        }

        stop() {
            this.loop = null;
            this.timidity.pause();
        }

        pause() {
            this.timidity.pause();
        }

        resume() {
            this.timidity.play();
        }

        getPosition(): number {
            return Math.round(this.timidity.currentTime * 1000);
        }

        setVolume(vol: number) {

        }

        getVolume(): number {
            return 100;
        }

        private onError() {
            console.log('onError');
        }

        private onEnd() {
            if (this.loop !== null) {
                if (--this.loop === 0)
                    this.loop = null;
                else
                    this.timidity.play();
            }
        }

        private removeSafariGestureRestriction() {
            if (typeof (webkitAudioContext) === 'undefined')
                return;
            let context = this.timidity._audioContext;
            let handler = () => {
                let src = context.createBufferSource();
                src.buffer = context.createBuffer(1, 1, 22050);
                src.connect(context.destination);
                src.start();
                console.log('MIDI AudioContext unlocked');
                window.removeEventListener('touchend', handler);
                window.removeEventListener('mouseup', handler);
            };
            window.addEventListener('touchend', handler);
            window.addEventListener('mouseup', handler);
        }
    }
}
