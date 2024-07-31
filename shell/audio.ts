// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { MainModule as System3Module } from './system3.js';
import type { MainModule as XSystem35Module } from './xsystem35.js';
import {gaException, Bool, Status, DRIType, ald_getdata, loadScript} from './util.js';
import * as volumeControl from './volume.js';

const PCM_SLOTS = 1 + 128;
const slots: (PCMSound | null)[] = [];
const slotVolume: number[] = new Array(PCM_SLOTS).fill(1.0);
let bufCache: AudioBuffer[] = [];
const destNode = volumeControl.audioNode();

function init() {
    document.addEventListener('visibilitychange', onVisibilityChange);
}

async function load(no: number): Promise<AudioBuffer> {
    const dfile = ald_getdata(Module as XSystem35Module, DRIType.WAVE, no - 1);
    if (!dfile)
        throw new Error('Failed to open wave ' + no);

    // If the AudioContext was not created inside a user-initiated event
    // handler, then it will be suspended. Attempt to resume it.
    volumeControl.audioContext.resume();

    const audioBuf = await decodeAudioData(dfile.data);
    bufCache[no] = audioBuf;
    return audioBuf;
}

async function decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    try {
        return await destNode.context.decodeAudioData(buf);
    } catch (err) {
        const a = new Uint8Array(buf);
        if (a[0] === 0x4f && a[1] === 0x67 && a[2] === 0x67 && a[3] === 0x53) { // 'OggS'
            await loadScript('lib/stbvorbis-0.2.2.js');
            const data: Float32Array[][] = [];
            let sampleRate = 0;
            return new Promise((resolve, reject) => {
                stbvorbis.decode(buf, (event) => {
                    if (event.error) {
                        reject(event.error);
                    } else if (!event.eof) {
                        if (data.length === 0) sampleRate = event.sampleRate;
                        data.push(event.data);
                    } else {
                        const nr_channels = data[0].length;
                        const len = data.reduce((sum, channels) => sum + channels[0].length, 0);
                        const audioBuf = destNode.context.createBuffer(nr_channels, len, sampleRate);
                        for (let ch = 0; ch < nr_channels; ch++) {
                            const b = audioBuf.getChannelData(ch);
                            let offset = 0;
                            for (const chunks of data) {
                                b.set(chunks[ch], offset);
                                offset += chunks[ch].length;
                            }
                        }
                        resolve(audioBuf);
                    }
                });
            });
        }
        throw err;
    }
}

export function pcm_reset() {
    for (let i = 0; i < slots.length; i++) {
        pcm_unload(i);
    }
}

export async function pcm_load(slot: number, no: number): Promise<Status> {
    pcm_stop(slot);
    if (bufCache[no]) {
        slots[slot] = new PCMSoundSimple(destNode, bufCache[no], slotVolume[slot]);
        return Status.OK;
    }
    try {
        const audioBuf = await load(no);
        slots[slot] = new PCMSoundSimple(destNode, audioBuf, slotVolume[slot]);
        return Status.OK;
    } catch (err) {
        gaException({type: 'PCM', err});
        return Status.NG;
    }
}

export async function pcm_load_data(slot: number, buf: number, len: number): Promise<Status> {
    pcm_stop(slot);
    try {
        const audioBuf = await decodeAudioData(Module!.HEAPU8.slice(buf, buf + len).buffer);
        slots[slot] = new PCMSoundSimple(destNode, audioBuf, slotVolume[slot]);
        return Status.OK;
    } catch (err) {
        gaException({type: 'PCM', err});
        return Status.NG;
    }
}

export async function pcm_load_mixlr(slot: number, noL: number, noR: number): Promise<Status> {
    pcm_stop(slot);
    if (bufCache[noL] && bufCache[noR]) {
        slots[slot] = new PCMSoundMixLR(destNode, bufCache[noL], bufCache[noR], slotVolume[slot]);
        return Status.OK;
    }
    try {
        const bufs = await Promise.all([
            bufCache[noL] ? Promise.resolve(bufCache[noL]) : load(noL),
            bufCache[noR] ? Promise.resolve(bufCache[noR]) : load(noR),
        ]);
        slots[slot] = new PCMSoundMixLR(destNode, bufs[0], bufs[1], slotVolume[slot]);
        return Status.OK;
    } catch (err) {
        gaException({type: 'PCM', err});
        return Status.NG;
    }
}

export function pcm_unload(slot: number): Status {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.stop();
    slots[slot] = null;
    return Status.OK;
}

export function pcm_start(slot: number, loop: number): Status {
    let sound = slots[slot];
    if (!sound) {
        console.log('pcm_start: invalid slot', slot);
        return Status.NG;
    }
    sound.start(loop);
    return Status.OK;
}

export function pcm_stop(slot: number): Status {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.stop();
    if (slot === 0)  // slot 0 plays at most once
        slots[slot] = null;
    return Status.OK;
}

export function pcm_fadeout(slot: number, msec: number): Status {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    if (msec === 0) {
        sound.stop();
    } else {
        sound.fadeout(msec);
    }
    return Status.OK;
}

export function pcm_getpos(slot: number): number {
    let sound = slots[slot];
    if (!sound)
        return 0;
    return sound.getPosition() * 1000;
}

export function pcm_setvol(slot: number, vol: number): Status {
    slotVolume[slot] = vol / 100;
    let sound = slots[slot];
    if (sound)
        sound.setGain(slotVolume[slot]);
    return Status.OK;
}

export function pcm_getwavelen(slot: number): number {
    let sound = slots[slot];
    if (!sound)
        return 0;
    return sound.duration * 1000;
}

export function pcm_isplaying(slot: number): Bool {
    let sound = slots[slot];
    if (!sound)
        return Bool.FALSE;
    return sound.isPlaying() ? Bool.TRUE : Bool.FALSE;
}

export async function pcm_waitend(slot: number): Promise<Status> {
    let sound = slots[slot];
    if (!sound)
        return Status.OK;
    await sound.waitForEnd();
    return Status.OK;
}

function onVisibilityChange() {
    if (document.hidden)
        bufCache = [];
}

abstract class PCMSound {
    private end_callback: (() => void) | null = null;
    protected context: BaseAudioContext;
    protected gain: GainNode;
    protected startTime: number | null = null;

    constructor(protected dst: AudioNode, initialGain: number) {
        this.context = dst.context;
        this.gain = this.context.createGain();
        this.setGain(initialGain);
        this.gain.connect(dst);
    }
    abstract start(loop: number): void;
    abstract stop(after_msec?: number): void;
    abstract get duration(): number;
    setGain(gain: number) {
        this.gain.gain.value = gain;
    }
    fadeout(msec: number) {
        this.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + msec / 1000);
        this.stop(msec);
    }
    getPosition(): number {
        if (this.startTime === null)
            return 0;
        return this.context.currentTime - this.startTime;
    }
    isPlaying(): boolean {
        return this.startTime !== null;
    }
    waitForEnd(): Promise<void> {
        if (!this.isPlaying()) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.end_callback = resolve;
        });
    }

    protected ended() {
        this.startTime = null;
        if (this.end_callback) {
            this.end_callback();
            this.end_callback = null;
        }
    }
}

class PCMSoundSimple extends PCMSound {
    private node!: AudioBufferSourceNode;

    constructor(dst: AudioNode, private buf: AudioBuffer, initialGain: number) {
        super(dst, initialGain);
    }

    start(loop: number) {
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

    stop(after_msec?: number) {
        if (this.startTime !== null) {
            this.node.stop(after_msec ? this.context.currentTime + after_msec / 1000 : undefined);
        }
    }

    get duration() {
        return this.buf.duration;
    }

    private onended() {
        this.ended();
    }
}

class PCMSoundMixLR extends PCMSound {
    private lsrc: AudioBufferSourceNode;
    private rsrc: AudioBufferSourceNode;
    private endCount = 0;

    constructor(dst: AudioNode, lbuf: AudioBuffer, rbuf: AudioBuffer, initialGain: number) {
        super(dst, initialGain);
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

    start(loop: number) {
        if (loop !== 1)
            console.warn('PCMSoundMixLR: loop is not supported ' + loop);
        this.lsrc.start();
        this.rsrc.start();
        this.startTime = this.context.currentTime;
    }

    stop(after_msec?: number) {
        if (this.startTime !== null) {
            const when = after_msec ? this.context.currentTime + after_msec / 1000 : undefined;
            this.lsrc.stop(when);
            this.rsrc.stop(when);
        }
    }

    get duration() {
        return Math.max(this.lsrc.buffer!.duration, this.rsrc.buffer!.duration);
    }

    private onended() {
        this.endCount++;
        if (this.endCount === 2)
            this.ended();
    }
}

let scriptNode: ScriptProcessorNode;

export function enable_audio_hook(): number {
    if (!scriptNode) {
        const BUFSIZE = 4096;
        scriptNode = destNode.context.createScriptProcessor(BUFSIZE, 0, 2);
        let bufptr = Module!._malloc(BUFSIZE * 2 * 2);
        scriptNode.addEventListener('audioprocess', (event) => {
            const output0 = event.outputBuffer.getChannelData(0);
            const output1 = event.outputBuffer.getChannelData(1);
            if ((Module as System3Module)._audio_callback(bufptr, BUFSIZE)) {
                for (let i = 0; i < BUFSIZE; i++) {
                    output0[i] = Module!.HEAP16[(bufptr >> 1) + i * 2] / 0x8000;
                    output1[i] = Module!.HEAP16[(bufptr >> 1) + i * 2 + 1] / 0x8000;
                }
            } else {
                for (let i = 0; i < BUFSIZE; i++) {
                    output0[i] = output1[i] = 0;
                }
            }
        });
        scriptNode.connect(destNode);
    }
    // If the AudioContext was not created inside a user-initiated event
    // handler, then it will be suspended. Attempt to resume it.
    volumeControl.audioContext.resume();

    return scriptNode.context.sampleRate;
}

init();
