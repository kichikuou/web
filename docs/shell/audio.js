// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { gaException, Bool, Status } from './util.js';
import { volumeControl } from './volume.js';
class AudioManager {
    constructor(destNode) {
        this.destNode = destNode;
        this.slots = [];
        this.bufCache = [];
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
    }
    load(no) {
        const buf = this.getWave(no);
        if (!buf)
            return Promise.reject('Failed to open wave ' + no);
        // If the AudioContext was not created inside a user-initiated event
        // handler, then it will be suspended. Attempt to resume it.
        this.destNode.context.resume();
        let decoded;
        if (typeof (webkitAudioContext) !== 'undefined') { // Safari
            decoded = new Promise((resolve, reject) => {
                this.destNode.context.decodeAudioData(buf, resolve, reject);
            });
        }
        else {
            decoded = this.destNode.context.decodeAudioData(buf);
        }
        return decoded.then((audioBuf) => {
            this.bufCache[no] = audioBuf;
            return audioBuf;
        });
    }
    getWave(no) {
        let dfile = _ald_getdata(2 /* DRIFILE_WAVE */, no - 1);
        if (!dfile)
            return null;
        let ptr = Module.getValue(dfile + 8, '*');
        let size = Module.getValue(dfile, 'i32');
        let buf = Module.HEAPU8.buffer.slice(ptr, ptr + size);
        _ald_freedata(dfile);
        return buf;
    }
    pcm_load(slot, no) {
        return Asyncify.handleSleep((wakeUp) => {
            this.pcm_stop(slot);
            if (this.bufCache[no]) {
                this.slots[slot] = new PCMSoundSimple(this.destNode, this.bufCache[no]);
                return wakeUp(Status.OK);
            }
            this.load(no).then((audioBuf) => {
                this.slots[slot] = new PCMSoundSimple(this.destNode, audioBuf);
                wakeUp(Status.OK);
            }).catch((err) => {
                gaException({ type: 'PCM', err });
                wakeUp(Status.NG);
            });
        });
    }
    pcm_load_mixlr(slot, noL, noR) {
        return Asyncify.handleSleep((wakeUp) => {
            this.pcm_stop(slot);
            if (this.bufCache[noL] && this.bufCache[noR]) {
                this.slots[slot] = new PCMSoundMixLR(this.destNode, this.bufCache[noL], this.bufCache[noR]);
                return wakeUp(Status.OK);
            }
            let ps = [
                this.bufCache[noL] ? Promise.resolve(this.bufCache[noL]) : this.load(noL),
                this.bufCache[noR] ? Promise.resolve(this.bufCache[noR]) : this.load(noR),
            ];
            Promise.all(ps).then((bufs) => {
                this.slots[slot] = new PCMSoundMixLR(this.destNode, bufs[0], bufs[1]);
                wakeUp(Status.OK);
            }).catch((err) => {
                gaException({ type: 'PCM', err });
                wakeUp(Status.NG);
            });
        });
    }
    pcm_unload(slot) {
        let sound = this.slots[slot];
        if (!sound)
            return Status.NG;
        sound.stop();
        this.slots[slot] = null;
        return Status.OK;
    }
    pcm_start(slot, loop) {
        let sound = this.slots[slot];
        if (!sound) {
            console.log('pcm_start: invalid slot', slot);
            return Status.NG;
        }
        if (typeof (webkitAudioContext) !== 'undefined' &&
            this.destNode.context.state === 'suspended') {
            // Safari: The audio context is still locked. If we attempt to play
            // a sound on it, it will start later when the context is unlocked.
            return Status.NG;
        }
        sound.start(loop);
        return Status.OK;
    }
    pcm_stop(slot) {
        let sound = this.slots[slot];
        if (!sound)
            return Status.NG;
        sound.stop();
        if (slot === 0) // slot 0 plays at most once
            this.slots[slot] = null;
        return Status.OK;
    }
    pcm_fadeout(slot, msec) {
        let sound = this.slots[slot];
        if (!sound)
            return Status.NG;
        sound.fadeout(msec);
        return Status.OK;
    }
    pcm_getpos(slot) {
        let sound = this.slots[slot];
        if (!sound)
            return 0;
        return sound.getPosition() * 1000;
    }
    pcm_setvol(slot, vol) {
        let sound = this.slots[slot];
        if (!sound)
            return Status.NG;
        sound.setGain(vol / 100);
        return Status.OK;
    }
    pcm_getwavelen(slot) {
        let sound = this.slots[slot];
        if (!sound)
            return 0;
        return sound.duration * 1000;
    }
    pcm_isplaying(slot) {
        let sound = this.slots[slot];
        if (!sound)
            return Bool.FALSE;
        return sound.isPlaying() ? Bool.TRUE : Bool.FALSE;
    }
    pcm_waitend(slot) {
        return Asyncify.handleSleep((wakeUp) => {
            let sound = this.slots[slot];
            if (!sound || !sound.isPlaying())
                return wakeUp(Status.OK);
            sound.end_callback = () => wakeUp(Status.OK);
        });
    }
    onVisibilityChange() {
        if (document.hidden)
            this.bufCache = [];
    }
}
export let audio = new AudioManager(volumeControl.audioNode());
class PCMSound {
    constructor(dst) {
        this.dst = dst;
        this.context = dst.context;
        this.gain = this.context.createGain();
        this.gain.connect(dst);
    }
    setGain(gain) {
        this.gain.gain.value = gain;
    }
    fadeout(msec) {
        this.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + msec / 1000);
    }
    getPosition() {
        if (!this.startTime)
            return 0;
        return this.context.currentTime - this.startTime;
    }
    isPlaying() {
        return !!this.startTime;
    }
    ended() {
        this.startTime = null;
        if (this.end_callback) {
            this.end_callback();
            this.end_callback = null;
        }
    }
}
class PCMSoundSimple extends PCMSound {
    constructor(dst, buf) {
        super(dst);
        this.buf = buf;
    }
    start(loop) {
        this.node = this.context.createBufferSource();
        this.node.buffer = this.buf;
        this.node.connect(this.gain);
        this.node.onended = this.onended.bind(this);
        if (loop !== 1)
            this.node.loop = true;
        if (loop <= 1)
            this.node.start();
        else
            this.node.start(0, 0, this.buf.duration * loop);
        this.startTime = this.context.currentTime;
    }
    stop() {
        if (this.startTime) {
            this.node.stop();
            this.startTime = null;
        }
    }
    get duration() {
        return this.buf.duration;
    }
    onended() {
        this.ended();
    }
}
class PCMSoundMixLR extends PCMSound {
    constructor(dst, lbuf, rbuf) {
        super(dst);
        this.endCount = 0;
        this.lsrc = this.context.createBufferSource();
        this.rsrc = this.context.createBufferSource();
        this.lsrc.buffer = lbuf;
        this.rsrc.buffer = rbuf;
        let merger = this.context.createChannelMerger(2);
        merger.connect(this.gain);
        this.lsrc.connect(merger, 0, 0);
        this.rsrc.connect(merger, 0, 1);
        this.lsrc.onended = this.rsrc.onended = this.onended.bind(this);
    }
    start(loop) {
        if (loop !== 1)
            console.warn('PCMSoundMixLR: loop is not supported ' + loop);
        this.lsrc.start();
        this.rsrc.start();
        this.startTime = this.context.currentTime;
    }
    stop() {
        if (this.startTime) {
            this.lsrc.stop();
            this.rsrc.stop();
            this.startTime = null;
        }
    }
    get duration() {
        return Math.max(this.lsrc.buffer.duration, this.rsrc.buffer.duration);
    }
    onended() {
        this.endCount++;
        if (this.endCount === 2)
            this.ended();
    }
}
