// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

declare class Timidity {
    constructor(dst: AudioNode, baseurl?: string);
    load(urlOrBuf: string | Uint8Array): void;
    play(): void;
    pause(): void;
    on(event: string, callback: () => void): void;
    currentTime: number;
}

namespace xsystem35 {
    export class MIDIPlayer {
        private timidity: Timidity;
        private playing = false;

        constructor(destNode: AudioNode) {
            Module.addRunDependency('timidity');
            let script = document.createElement('script');
            script.src = '/timidity/timidity.js';
            script.onload = () => {
                Module.removeRunDependency('timidity');

                this.timidity = new Timidity(destNode, '/timidity/');
                this.timidity.on('error', this.onError.bind(this));
                this.timidity.on('ended', this.onEnd.bind(this));
            }
            document.body.appendChild(script);
        }

        play(loop: number, data: number, datalen: number) {
            this.timidity.load(Module.HEAPU8.subarray(data, data + datalen));
            this.timidity.play();
            this.playing = true;
            // NOTE: `loop` is ignored.
        }

        stop() {
            this.playing = false;
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
            if (this.playing)
                this.timidity.play();
        }
    }
}
