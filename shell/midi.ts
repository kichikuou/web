// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {loadScript} from './util.js';

declare class Timidity {
    constructor(dst: AudioNode, baseurl?: string);
    load(urlOrBuf: string | Uint8Array): Promise<void>;
    play(): void;
    pause(): void;
    on(event: 'playing', callback: (playbackTime: number) => void): void;
    on(event: string, callback: () => void): void;
    currentTime: number;
}

class MIDIPlayer {
    private timidity: Timidity | undefined;
    private gain!: GainNode;
    private playing = false;
    private fadeFinishTime = 0;
    private stopTimer: number | null = null;

    init(destNode: AudioNode) {
        Module.addRunDependency('timidity');
        loadScript('/timidity/timidity.js').then(() => {
            Module.removeRunDependency('timidity');

            this.gain = destNode.context.createGain();
            this.gain.connect(destNode);
            this.timidity = new Timidity(this.gain, '/timidity/');
            this.timidity.on('playing', this.onPlaying.bind(this));
            this.timidity.on('error', this.onError.bind(this));
            this.timidity.on('ended', this.onEnd.bind(this));
        });
    }

    play(loop: number, data: number, datalen: number) {
        if (!this.timidity)
            return;
        this.timidity.load(Module.HEAPU8.slice(data, data + datalen));
        this.timidity.play();
        this.playing = true;
        // NOTE: `loop` is ignored.
    }

    stop() {
        if (!this.timidity)
            return;
        this.playing = false;
        this.timidity.pause();
    }

    pause() {
        if (!this.timidity)
            return;
        this.timidity.pause();
    }

    resume() {
        if (!this.timidity)
            return;
        this.timidity.play();
    }

    getPosition(): number {
        if (!this.timidity)
            return 0;
        return Math.round(this.timidity.currentTime * 1000);
    }

    setVolume(vol: number) {
        if (!this.timidity)
            return;
        this.gain.gain.value = vol / 100;
    }

    getVolume(): number {
        if (!this.timidity)
            return 100;
        return this.gain.gain.value * 100;
    }

    fadeStart(ms: number, vol: number, stop: number) {
        if (!this.timidity)
            return;
        // Cancel previous fade
        this.gain.gain.cancelScheduledValues(this.gain.context.currentTime);
        if (this.stopTimer !== null) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }

        // Resetting the volume while not playing?
        if (ms === 0 && vol === 100 && (this.stopTimer || !this.playing)) {
            // No worries, playback always starts with volume 100%
            return;
        }

        this.gain.gain.linearRampToValueAtTime(vol / 100, this.gain.context.currentTime + ms / 1000);
        this.fadeFinishTime = performance.now() + ms;
        if (stop) {
            if (ms === 0)
                this.stop();
            else {
                this.stopTimer = setTimeout(() => {
                    this.stop();
                    this.stopTimer = null;
                }, ms);
            }
        }
    }

    isFading(): number {
        if (!this.timidity)
            return 0;
        return performance.now() < this.fadeFinishTime ? 1 : 0;
    }

    private onPlaying(playbackTime: number) {
        if (!playbackTime)
            return;
        // Reset volume to 100% at the start of playback
        this.gain.gain.setValueAtTime(1, playbackTime);
    }

    private onError() {
        console.log('onError');
    }

    private onEnd() {
        if (this.playing)
            this.timidity!.play();
    }
}
export let midiPlayer = new MIDIPlayer();
