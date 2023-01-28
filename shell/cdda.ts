// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, Deferred, gaException, isMobileSafari} from './util.js';
import {BGMLoader, CDDALoader} from './cddaloader.js';
import * as volumeControl from './volume.js';

const audio = <HTMLAudioElement>$('audio');
let cddaLoader: CDDALoader | undefined;
let currentTrack: number | null = null;
let isVolumeSupported: boolean;
let fadeVolume = 1.0;
let fader: Fader | undefined;
let unmute: (() => void) | null = null;  // Non-null if emulating mute by pause

class Fader {
    private done: Deferred<void>;
    private timer: number | undefined;

    constructor(duration: number, target: number) {
        const start = performance.now();
        const initial = fadeVolume;
        this.done = new Deferred();
        this.timer = setInterval(() => {
            const t = performance.now() - start;
            fadeVolume = t >= duration ? target : initial + (t / duration) * (target - initial);
            audio.volume = volumeControl.volume() * fadeVolume;
            if (t >= duration) {
                clearInterval(this.timer);
                this.timer = undefined;
                this.done.resolve();
            }
        }, 10);
    }

    cancel() {
        clearInterval(this.timer);
        this.timer = undefined;
        this.done.resolve();
    }

    wait(): Promise<void> {
        return this.done.promise;
    }
}

function init() {
    // Volume control of <audio> is not supported in iOS
    isVolumeSupported = !isMobileSafari();

    volumeControl.addEventListener(onVolumeChanged);
    audio.volume = volumeControl.volume();
    audio.addEventListener('error', onAudioError);
    removeUserGestureRestriction(true);
    if (!isVolumeSupported) {
        volumeControl.hideSlider();
        if (audio.volume === 0)
            unmute = () => {};
    }
}

export function setCDDALoader(loader: CDDALoader) {
    cddaLoader = loader;
}

export function setBGMLoader(type: number, base_no: number) {
    setCDDALoader(new CDDALoader(new BGMLoader(type, base_no)));
}

export async function play(track: number, loop: number) {
    currentTrack = track;
    if (unmute) {
        unmute = () => { play(track, loop); };
        return;
    }
    audio.currentTime = 0;
    try {
        const url = await cddaLoader!.getCDDA(track, audio)
        startPlayback(url, loop);
    } catch (err) {
        ga('send', 'event', 'CDDA', 'InvalidTrack');
    }
}

export async function stop(fadeout_ms?: number) {
    if (fadeout_ms) {
        await fade(fadeout_ms, 0);
    }
    audio.pause();
    currentTrack = null;
    if (unmute)
        unmute = () => {};
}

export async function fade(duration: number, target: number): Promise<void> {
    if (!isVolumeSupported) {
        return;
    }
    if (fader) {
        fader.cancel();
        fader = undefined;
    }
    if (duration <= 0) {
        fadeVolume = target;
        audio.volume = volumeControl.volume() * fadeVolume;
        return;
    }
    fader = new Fader(duration, target);
    return fader.wait();
}

export function getPosition(): number {
    if (!currentTrack)
        return 0;
    let time = Math.round(audio.currentTime * 75);
    if (unmute || audio.error)
        time += 750;  // unblock Kichikuou OP
    return currentTrack | time << 8;
}

function startPlayback(url: string, loop: number) {
    audio.setAttribute('src', url);
    audio.loop = (loop !== 0);
    audio.load();
    audio.play().catch((err) => {
        if (err.message.startsWith('The play() request was interrupted') ||  // Chrome
            err.name === 'AbortError') {  // Safari
            // These errors are harmless, do nothing
        } else if (err.name === 'NotAllowedError' || err.message.indexOf('gesture') >= 0) {
            // Audio still locked?
            removeUserGestureRestriction(false);
            ga('send', 'event', 'CDDA', 'UnlockAgain');
        } else {
            let {name, message} = err;
            gaException({type: 'CDDA', name, message});
        }
    });
}

function onVolumeChanged(evt: CustomEvent) {
    if (isVolumeSupported) {
        audio.volume = evt.detail;
        return;
    }
    let muted = evt.detail === 0;
    if (!!unmute === muted)
        return;
    if (muted) {
        audio.pause();
        unmute = () => { audio.play(); };
    } else {
        let f = unmute!;
        unmute = null;
        f();
    }
}

function onAudioError(err: ErrorEvent) {
    if (audio.error) {
        let {code, message} = audio.error;
        gaException({type: 'Audio', code, message});
    } else {
        gaException({type: 'Audio', code: 'unknown'});
    }
}

function removeUserGestureRestriction(firstTime: boolean) {
    let hanlder = () => {
        if (!firstTime) {
            audio.play();
        } else if (!currentTrack) {
            audio.load();
            console.log('CDDA unlocked');
        }
        window.removeEventListener('touchend', hanlder);
        window.removeEventListener('mouseup', hanlder);
    };
    window.addEventListener('touchend', hanlder);
    window.addEventListener('mouseup', hanlder);
}

init();
