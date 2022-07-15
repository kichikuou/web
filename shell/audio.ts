// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {gaException, Bool, Status, DRIType, ald_getdata, loadScript} from './util.js';
import * as volumeControl from './volume.js';

declare global {
    interface BaseAudioContext {
        resume(): Promise<void>;  // Missing in lib.dom.d.ts of TypeScript 3.6.2
    }
}

const slots: (PCMSound | null)[] = [];
let bufCache: AudioBuffer[] = [];
const destNode = volumeControl.audioNode();

function init() {
    document.addEventListener('visibilitychange', onVisibilityChange);
}

async function load(no: number): Promise<AudioBuffer> {
    const buf = ald_getdata(DRIType.WAVE, no - 1);
    if (!buf)
        throw new Error('Failed to open wave ' + no);

    // If the AudioContext was not created inside a user-initiated event
    // handler, then it will be suspended. Attempt to resume it.
    destNode.context.resume();

    const audioBuf = await decodeAudioData(buf);
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

export function pcm_load(slot: number, no: number) {
    return Asyncify.handleSleep((wakeUp: (result: Status) => void) => {
        pcm_stop(slot);
        if (bufCache[no]) {
            slots[slot] = new PCMSoundSimple(destNode, bufCache[no]);
            return wakeUp(Status.OK);
        }
        load(no).then((audioBuf) => {
            slots[slot] = new PCMSoundSimple(destNode, audioBuf);
            wakeUp(Status.OK);
        }, (err) => {
            gaException({type: 'PCM', err});
            wakeUp(Status.NG);
        });
    });
}

export function pcm_load_mixlr(slot: number, noL: number, noR: number) {
    return Asyncify.handleSleep((wakeUp: (result: Status) => void) => {
        pcm_stop(slot);
        if (bufCache[noL] && bufCache[noR]) {
            slots[slot] = new PCMSoundMixLR(destNode, bufCache[noL], bufCache[noR]);
            return wakeUp(Status.OK);
        }
        let ps: [Promise<AudioBuffer>, Promise<AudioBuffer>] = [
            bufCache[noL] ? Promise.resolve(bufCache[noL]) : load(noL),
            bufCache[noR] ? Promise.resolve(bufCache[noR]) : load(noR),
        ];
        Promise.all(ps).then((bufs) => {
            slots[slot] = new PCMSoundMixLR(destNode, bufs[0], bufs[1]);
            wakeUp(Status.OK);
        }).catch((err) => {
            gaException({type: 'PCM', err});
            wakeUp(Status.NG);
        });
    });
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
    sound.fadeout(msec);
    return Status.OK;
}

export function pcm_getpos(slot: number): number {
    let sound = slots[slot];
    if (!sound)
        return 0;
    return sound.getPosition() * 1000;
}

export function pcm_setvol(slot: number, vol: number): Status {
    let sound = slots[slot];
    if (!sound)
        return Status.NG;
    sound.setGain(vol / 100);
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

export function pcm_waitend(slot: number) {
    return Asyncify.handleSleep((wakeUp: (result: Status) => void) => {
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

abstract class PCMSound {
    end_callback: (() => void) | null = null;
    protected context: BaseAudioContext;
    protected gain: GainNode;
    protected startTime: number | null = null;

    constructor(protected dst: AudioNode) {
        this.context = dst.context;
        this.gain = this.context.createGain();
        this.gain.connect(dst);
    }
    abstract start(loop: number): void;
    abstract stop(): void;
    setGain(gain: number) {
        this.gain.gain.value = gain;
    }
    fadeout(msec: number) {
        this.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + msec / 1000);
    }
    getPosition(): number {
        if (this.startTime === null)
            return 0;
        return this.context.currentTime - this.startTime;
    }
    isPlaying(): boolean {
        return this.startTime !== null;
    }
    abstract get duration(): number;

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

    constructor(dst: AudioNode, private buf: AudioBuffer) {
        super(dst);
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

    stop() {
        if (this.startTime !== null) {
            this.node.stop();
            this.startTime = null;
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

    constructor(dst: AudioNode, lbuf: AudioBuffer, rbuf: AudioBuffer) {
        super(dst);
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

    stop() {
        if (this.startTime !== null) {
            this.lsrc.stop();
            this.rsrc.stop();
            this.startTime = null;
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
        let bufptr = Module._malloc(BUFSIZE * 2 * 2);
        scriptNode.addEventListener('audioprocess', (event) => {
            const output0 = event.outputBuffer.getChannelData(0);
            const output1 = event.outputBuffer.getChannelData(1);
            if (_audio_callback(bufptr, BUFSIZE)) {
                for (let i = 0; i < BUFSIZE; i++) {
                    output0[i] = Module.HEAP16[(bufptr >> 1) + i * 2] / 0x8000;
                    output1[i] = Module.HEAP16[(bufptr >> 1) + i * 2 + 1] / 0x8000;
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
    scriptNode.context.resume();

    return scriptNode.context.sampleRate;
}

init();
