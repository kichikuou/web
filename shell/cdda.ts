// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, gaException} from './util.js';
import * as volumeControl from './volume.js';
import {CDDACache, BasicCDDACache, IOSCDDACache} from './cddacache.js';

let cddaCache: CDDACache;
const audio = <HTMLAudioElement>$('audio');
let currentTrack: number | null = null;
let isVolumeSupported: boolean;
let unmute: (() => void) | null = null;  // Non-null if emulating mute by pause

function init() {
    // Volume control of <audio> is not supported in iOS
    audio.volume = 0.5;
    isVolumeSupported = audio.volume !== 1;

    cddaCache = isVolumeSupported ? new BasicCDDACache() : new IOSCDDACache();

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

export async function play(track: number, loop: number) {
    currentTrack = track;
    if (unmute) {
        unmute = () => { play(track, loop); };
        return;
    }
    audio.currentTime = 0;
    try {
        let blob = await cddaCache.getCDDA(track)
        startPlayback(blob, loop);
    } catch (err) {
        ga('send', 'event', 'CDDA', 'InvalidTrack');
    }
}

export function stop() {
    audio.pause();
    currentTrack = null;
    if (unmute)
        unmute = () => {};
}

export function getPosition(): number {
    if (!currentTrack)
        return 0;
    let time = Math.round(audio.currentTime * 75);
    if (unmute || audio.error)
        time += 750;  // unblock Kichikuou OP
    return currentTrack | time << 8;
}

function startPlayback(blob: Blob, loop: number) {
    audio.setAttribute('src', URL.createObjectURL(blob));
    audio.loop = (loop !== 0);
    audio.load();
    let p: any = audio.play();  // Edge returns undefined
    if (p instanceof Promise) {
        p.catch((err) => {
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
