// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { WorkletSynthesizer, Sequencer } from "./spessasynth.js";
import { addToast } from './widgets.js';
import { message } from './strings.js';

let SpessaSynth: typeof import('./spessasynth.js') | undefined;
let synth: WorkletSynthesizer | undefined;
let seq: Sequencer | undefined;
let gain!: GainNode;
let fadeFinishTime = 0;
let stopTimer: number | null = null;

export async function init(destNode: AudioNode) {
    Module!.addRunDependency('SpessaSynth');
    try {
        const sfFetch = fetch("soundfonts/GeneralUserGS.sf3");
        SpessaSynth = await import("./spessasynth.js");
        await destNode.context.audioWorklet.addModule("./spessasynth_processor.min.js");
        gain = destNode.context.createGain();
        gain.connect(destNode);
        const sfResp = await sfFetch;
        if (!sfResp.ok)
            throw new Error(`Failed to load soundfont: ${sfResp.statusText}`);
        synth = new SpessaSynth.WorkletSynthesizer(destNode.context);
        synth.connect(gain);
        await synth.soundBankManager.addSoundBank(await sfResp.arrayBuffer(), "main");
    } catch (e) {
        console.warn(e);
        addToast(message.midi_init_error, 'error');
        if (e instanceof Error) {
            gtag('event', 'MidiInitFailed', { event_category: 'MIDI', event_label: e.message });
        }
    }
    Module!.removeRunDependency('SpessaSynth');
}

export function play(loopCount: number, data: number, datalen: number) {
    if (!synth)
        return;
    const midiBuffers = [{
        binary: Module!.HEAPU8.slice(data, data + datalen),
        altName: undefined
    }];
    if (!seq) {
        seq = new SpessaSynth!.Sequencer(synth);
    }
    seq.loadNewSongList(midiBuffers);
    seq.loopCount = loopCount === 0 ? Infinity : loopCount - 1;
    seq.play();
}

export function stop() {
    seq?.pause();
}

export function pause() {
    seq?.pause();
}

export function resume() {
    seq?.play();
}

export function getPosition(): number {
    if (!seq || seq.isFinished)
        return 0;
    return Math.round(seq.currentTime * 1000);
}

export function fadeStart(ms: number, vol: number, stopAfterFade: number) {
    // Cancel previous fade
    gain.gain.cancelScheduledValues(gain.context.currentTime);
    if (stopTimer !== null) {
        clearTimeout(stopTimer);
        stopTimer = null;
    }

    gain.gain.linearRampToValueAtTime(vol / 100, gain.context.currentTime + ms / 1000);
    fadeFinishTime = performance.now() + ms;
    if (stopAfterFade) {
        if (ms === 0)
            stop();
        else {
            stopTimer = setTimeout(() => {
                stop();
                stopTimer = null;
            }, ms);
        }
    }
}

export function isFading(): number {
    return performance.now() < fadeFinishTime ? 1 : 0;
}
