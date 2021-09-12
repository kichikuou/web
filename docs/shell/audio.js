// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { gaException, Bool, Status } from './util.js';
import * as volumeControl from './volume.js';
const slots = [];
let bufCache = [];
const destNode = volumeControl.audioNode();
function init() {
    document.addEventListener('visibilitychange', onVisibilityChange);
}
function load(no) {
    const buf = getWave(no);
    if (!buf)
        return Promise.reject('Failed to open wave ' + no);
    // If the AudioContext was not created inside a user-initiated event
    // handler, then it will be suspended. Attempt to resume it.
    destNode.context.resume();
    return destNode.context.decodeAudioData(buf).then((audioBuf) => {
        bufCache[no] = audioBuf;
        return audioBuf;
    });
}
function getWave(no) {
    let dfile = _ald_getdata(2 /* DRIFILE_WAVE */, no - 1);
    if (!dfile)
        return null;
    let ptr = Module.getValue(dfile + 8, '*');
    let size = Module.getValue(dfile, 'i32');
    let buf = Module.HEAPU8.buffer.slice(ptr, ptr + size);
    _ald_freedata(dfile);
    return buf;
}
export function pcm_load(slot, no) {
    return Asyncify.handleSleep((wakeUp) => {
        pcm_stop(slot);
        if (bufCache[no]) {
            slots[slot] = new PCMSoundSimple(destNode, bufCache[no]);
            return wakeUp(Status.OK);
        }
        load(no).then((audioBuf) => {
            slots[slot] = new PCMSoundSimple(destNode, audioBuf);
            wakeUp(Status.OK);
        }).catch((err) => {
            gaException({ type: 'PCM', err });
            wakeUp(Status.NG);
        });
    });
}
export function pcm_load_mixlr(slot, noL, noR) {
    return Asyncify.handleSleep((wakeUp) => {
        pcm_stop(slot);
        if (bufCache[noL] && bufCache[noR]) {
            slots[slot] = new PCMSoundMixLR(destNode, bufCache[noL], bufCache[noR]);
            return wakeUp(Status.OK);
        }
        let ps = [
            bufCache[noL] ? Promise.resolve(bufCache[noL]) : load(noL),
            bufCache[noR] ? Promise.resolve(bufCache[noR]) : load(noR),
        ];
        Promise.all(ps).then((bufs) => {
            slots[slot] = new PCMSoundMixLR(destNode, bufs[0], bufs[1]);
            wakeUp(Status.OK);
        }).catch((err) => {
            gaException({ type: 'PCM', err });
            wakeUp(Status.NG);
        });
    });
}
export function pcm_unload(slot) {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.stop();
    slots[slot] = null;
    return Status.OK;
}
export function pcm_start(slot, loop) {
    let sound = slots[slot];
    if (!sound) {
        console.log('pcm_start: invalid slot', slot);
        return Status.NG;
    }
    sound.start(loop);
    return Status.OK;
}
export function pcm_stop(slot) {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.stop();
    if (slot === 0) // slot 0 plays at most once
        slots[slot] = null;
    return Status.OK;
}
export function pcm_fadeout(slot, msec) {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.fadeout(msec);
    return Status.OK;
}
export function pcm_getpos(slot) {
    let sound = slots[slot];
    if (!sound)
        return 0;
    return sound.getPosition() * 1000;
}
export function pcm_setvol(slot, vol) {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.setGain(vol / 100);
    return Status.OK;
}
export function pcm_getwavelen(slot) {
    let sound = slots[slot];
    if (!sound)
        return 0;
    return sound.duration * 1000;
}
export function pcm_isplaying(slot) {
    let sound = slots[slot];
    if (!sound)
        return Bool.FALSE;
    return sound.isPlaying() ? Bool.TRUE : Bool.FALSE;
}
export function pcm_waitend(slot) {
    return Asyncify.handleSleep((wakeUp) => {
        let sound = slots[slot];
        if (!sound || !sound.isPlaying())
            return wakeUp(Status.OK);
        sound.end_callback = () => wakeUp(Status.OK);
    });
}
function onVisibilityChange() {
    if (document.hidden)
        bufCache = [];
}
class PCMSound {
    constructor(dst) {
        this.dst = dst;
        this.end_callback = null;
        this.startTime = null;
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
        if (this.startTime === null)
            return 0;
        return this.context.currentTime - this.startTime;
    }
    isPlaying() {
        return this.startTime !== null;
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
        if (this.startTime !== null) {
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
        if (this.startTime !== null) {
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
let scriptNode;
export function enable_audio_hook() {
    if (!scriptNode) {
        const BUFSIZE = 4096;
        scriptNode = destNode.context.createScriptProcessor(BUFSIZE, 0, 2);
        let bufptr = Module._malloc(BUFSIZE * 2 * 2);
        scriptNode.addEventListener('audioprocess', (event) => {
            const output0 = event.outputBuffer.getChannelData(0);
            const output1 = event.outputBuffer.getChannelData(1);
            if (_audio_callback(bufptr, BUFSIZE)) {
                for (let i = 0; i < BUFSIZE; i++) {
                    output0[i] = Module.HEAP16[(bufptr >> 1) + i * 2] / 0x8000;
                    output1[i] = Module.HEAP16[(bufptr >> 1) + i * 2 + 1] / 0x8000;
                }
            }
            else {
                for (let i = 0; i < BUFSIZE; i++) {
                    output0[i] = output1[i] = 0;
                }
            }
        });
        scriptNode.connect(destNode);
    }
    // If the AudioContext was not created inside a user-initiated event
    // handler, then it will be suspended. Attempt to resume it.
    scriptNode.context.resume();
    return scriptNode.context.sampleRate;
}
init();
