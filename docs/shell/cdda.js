// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, gaException } from './util.js';
import { volumeControl } from './volume.js';
import { BasicCDDACache, IOSCDDACache } from './cddacache.js';
class CDPlayer {
    constructor() {
        this.audio = $('audio');
        this.currentTrack = null;
        this.unmute = null; // Non-null if emulating mute by pause
        // Volume control of <audio> is not supported in iOS
        this.audio.volume = 0.5;
        this.isVolumeSupported = this.audio.volume !== 1;
        this.cddaCache = this.isVolumeSupported ? new BasicCDDACache() : new IOSCDDACache();
        volumeControl.addEventListener(this.onVolumeChanged.bind(this));
        this.audio.volume = volumeControl.volume();
        this.audio.addEventListener('error', this.onAudioError.bind(this));
        this.removeUserGestureRestriction(true);
        if (!this.isVolumeSupported) {
            volumeControl.hideSlider();
            if (this.audio.volume === 0)
                this.unmute = () => { };
        }
    }
    async play(track, loop) {
        this.currentTrack = track;
        if (this.unmute) {
            this.unmute = () => { this.play(track, loop); };
            return;
        }
        this.audio.currentTime = 0;
        try {
            let blob = await this.cddaCache.getCDDA(track);
            this.startPlayback(blob, loop);
        }
        catch (err) {
            ga('send', 'event', 'CDDA', 'InvalidTrack');
        }
    }
    stop() {
        this.audio.pause();
        this.currentTrack = null;
        if (this.unmute)
            this.unmute = () => { };
    }
    getPosition() {
        if (!this.currentTrack)
            return 0;
        let time = Math.round(this.audio.currentTime * 75);
        if (this.unmute || this.audio.error)
            time += 750; // unblock Kichikuou OP
        return this.currentTrack | time << 8;
    }
    startPlayback(blob, loop) {
        this.audio.setAttribute('src', URL.createObjectURL(blob));
        this.audio.loop = (loop !== 0);
        this.audio.load();
        let p = this.audio.play(); // Edge returns undefined
        if (p instanceof Promise) {
            p.catch((err) => {
                if (err.message.startsWith('The play() request was interrupted') || // Chrome
                    err.name === 'AbortError') { // Safari
                    // These errors are harmless, do nothing
                }
                else if (err.name === 'NotAllowedError' || err.message.indexOf('gesture') >= 0) {
                    // Audio still locked?
                    this.removeUserGestureRestriction(false);
                    ga('send', 'event', 'CDDA', 'UnlockAgain');
                }
                else {
                    let { name, message } = err;
                    gaException({ type: 'CDDA', name, message });
                }
            });
        }
    }
    onVolumeChanged(evt) {
        if (this.isVolumeSupported) {
            this.audio.volume = evt.detail;
            return;
        }
        let muted = evt.detail === 0;
        if (!!this.unmute === muted)
            return;
        if (muted) {
            this.audio.pause();
            this.unmute = () => { this.audio.play(); };
        }
        else {
            let unmute = this.unmute;
            this.unmute = null;
            unmute();
        }
    }
    onAudioError(err) {
        if (this.audio.error) {
            let { code, message } = this.audio.error;
            gaException({ type: 'Audio', code, message });
        }
        else {
            gaException({ type: 'Audio', code: 'unknown' });
        }
    }
    removeUserGestureRestriction(firstTime) {
        let hanlder = () => {
            if (!firstTime) {
                this.audio.play();
            }
            else if (!this.currentTrack) {
                this.audio.load();
                console.log('CDDA unlocked');
            }
            window.removeEventListener('touchend', hanlder);
            window.removeEventListener('mouseup', hanlder);
        };
        window.addEventListener('touchend', hanlder);
        window.addEventListener('mouseup', hanlder);
    }
}
export let cdPlayer = new CDPlayer();
