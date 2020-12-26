// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
const slider = $('#volume-control-slider');
let audioContext;
let masterGain;
let vol = config.volume; // 0.0 - 1.0
let muted = false;
function init() {
    slider.value = String(Math.round(vol * 100));
    $('#volume-control-icon').addEventListener('click', onIconClicked);
    slider.addEventListener('input', onSliderValueChanged);
    slider.addEventListener('change', onSliderValueSettled);
    // Firefox fix, https://github.com/emscripten-ports/SDL2/issues/41
    slider.addEventListener('mouseup', () => { slider.blur(); });
    if (typeof (webkitAudioContext) !== 'undefined') {
        audioContext = new webkitAudioContext();
        removeUserGestureRestriction();
    }
    else {
        audioContext = new AudioContext();
    }
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    addEventListener(onVolumeChanged);
    masterGain.gain.value = volume();
    document.addEventListener('keydown', keyDownHandler);
}
export function audioNode() {
    return masterGain;
}
function removeUserGestureRestriction() {
    let handler = () => {
        let src = audioContext.createBufferSource();
        src.buffer = audioContext.createBuffer(1, 1, 22050);
        src.connect(audioContext.destination);
        src.start();
        console.log('AudioContext unlocked');
        window.removeEventListener('touchend', handler);
        window.removeEventListener('mouseup', handler);
    };
    window.addEventListener('touchend', handler);
    window.addEventListener('mouseup', handler);
}
export function volume() {
    return muted ? 0 : parseInt(slider.value, 10) / 100;
}
export function addEventListener(handler) {
    $('#volume-control').addEventListener('volumechange', handler);
}
export function hideSlider() {
    slider.hidden = true;
}
export function suspendForModalDialog() {
    audioContext.suspend();
    setTimeout(() => audioContext.resume(), 0);
}
function onIconClicked(e) {
    muted = !muted;
    if (muted) {
        $('#volume-control-icon').classList.remove('fa-volume-up');
        $('#volume-control-icon').classList.add('fa-volume-off');
        slider.value = '0';
    }
    else {
        $('#volume-control-icon').classList.remove('fa-volume-off');
        $('#volume-control-icon').classList.add('fa-volume-up');
        slider.value = String(Math.round(vol * 100));
    }
    dispatchEvent();
}
function onSliderValueChanged(e) {
    vol = parseInt(slider.value, 10) / 100;
    if (vol > 0 && muted) {
        muted = false;
        $('#volume-control-icon').classList.remove('fa-volume-off');
        $('#volume-control-icon').classList.add('fa-volume-up');
    }
    dispatchEvent();
}
function onSliderValueSettled(e) {
    config.volume = vol;
    config.persist();
}
function dispatchEvent() {
    let event = new CustomEvent('volumechange', { detail: volume() });
    $('#volume-control').dispatchEvent(event);
}
function onVolumeChanged(evt) {
    masterGain.gain.value = evt.detail;
}
function keyDownHandler(e) {
    if (e.keyCode === 77) { // m
        onIconClicked(e);
    }
}
init();
