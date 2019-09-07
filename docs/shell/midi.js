// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { loadScript } from './util.js';
class MIDIPlayer {
    constructor() {
        this.playing = false;
        this.fadeFinishTime = 0;
        this.stopTimer = null;
    }
    init(destNode) {
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
    play(loop, data, datalen) {
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
    getPosition() {
        if (!this.timidity)
            return 0;
        return Math.round(this.timidity.currentTime * 1000);
    }
    setVolume(vol) {
        if (!this.timidity)
            return;
        this.gain.gain.value = vol / 100;
    }
    getVolume() {
        if (!this.timidity)
            return 100;
        return this.gain.gain.value * 100;
    }
    fadeStart(ms, vol, stop) {
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
    isFading() {
        if (!this.timidity)
            return 0;
        return performance.now() < this.fadeFinishTime ? 1 : 0;
    }
    onPlaying(playbackTime) {
        if (!playbackTime)
            return;
        // Reset volume to 100% at the start of playback
        this.gain.gain.setValueAtTime(1, playbackTime);
    }
    onError() {
        console.log('onError');
    }
    onEnd() {
        if (this.playing)
            this.timidity.play();
    }
}
export let midiPlayer = new MIDIPlayer();
