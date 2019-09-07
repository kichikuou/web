// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
class VolumeControl {
    constructor() {
        this.vol = config.volume;
        this.muted = false;
        this.elem = $('#volume-control');
        this.icon = $('#volume-control-icon');
        this.slider = $('#volume-control-slider');
        this.slider.value = String(Math.round(this.vol * 100));
        this.icon.addEventListener('click', this.onIconClicked.bind(this));
        this.slider.addEventListener('input', this.onSliderValueChanged.bind(this));
        this.slider.addEventListener('change', this.onSliderValueSettled.bind(this));
        if (typeof (webkitAudioContext) !== 'undefined') {
            this.audioContext = new webkitAudioContext();
            this.removeUserGestureRestriction();
        }
        else {
            this.audioContext = new AudioContext();
        }
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.addEventListener(this.onVolumeChanged.bind(this));
        this.masterGain.gain.value = this.volume();
    }
    audioNode() {
        return this.masterGain;
    }
    removeUserGestureRestriction() {
        let handler = () => {
            let src = this.audioContext.createBufferSource();
            src.buffer = this.audioContext.createBuffer(1, 1, 22050);
            src.connect(this.audioContext.destination);
            src.start();
            console.log('AudioContext unlocked');
            window.removeEventListener('touchend', handler);
            window.removeEventListener('mouseup', handler);
        };
        window.addEventListener('touchend', handler);
        window.addEventListener('mouseup', handler);
    }
    volume() {
        return this.muted ? 0 : parseInt(this.slider.value, 10) / 100;
    }
    addEventListener(handler) {
        this.elem.addEventListener('volumechange', handler);
    }
    hideSlider() {
        this.slider.hidden = true;
    }
    suspendForModalDialog() {
        this.audioContext.suspend();
        setTimeout(() => this.audioContext.resume(), 0);
    }
    onIconClicked(e) {
        this.muted = !this.muted;
        if (this.muted) {
            this.icon.classList.remove('fa-volume-up');
            this.icon.classList.add('fa-volume-off');
            this.slider.value = '0';
        }
        else {
            this.icon.classList.remove('fa-volume-off');
            this.icon.classList.add('fa-volume-up');
            this.slider.value = String(Math.round(this.vol * 100));
        }
        this.dispatchEvent();
    }
    onSliderValueChanged(e) {
        this.vol = parseInt(this.slider.value, 10) / 100;
        if (this.vol > 0 && this.muted) {
            this.muted = false;
            this.icon.classList.remove('fa-volume-off');
            this.icon.classList.add('fa-volume-up');
        }
        this.dispatchEvent();
    }
    onSliderValueSettled(e) {
        config.volume = this.vol;
        config.persist();
    }
    dispatchEvent() {
        let event = new CustomEvent('volumechange', { detail: this.volume() });
        this.elem.dispatchEvent(event);
    }
    onVolumeChanged(evt) {
        this.masterGain.gain.value = evt.detail;
    }
}
export let volumeControl = new VolumeControl();
