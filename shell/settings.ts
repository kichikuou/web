// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';
import {config} from './config.js';
import {SaveDataManager} from './savedata.js';
import {openFileInput} from './widgets.js';

// Settings Dialog

const antialias = <HTMLInputElement>$('#antialias');
const synthSelect = <HTMLInputElement>$('#synthesizer');
const unloadConfirmation = <HTMLInputElement>$('#unload-confirmation');
let saveDataManager: SaveDataManager | null = null;
let keyDownHandler: (ev: KeyboardEvent) => void;

function init() {
    $('#settings-button').addEventListener('click', openModal);
    $('#settings-close').addEventListener('click', closeModal);
    keyDownHandler = (ev: KeyboardEvent) => {
        if (ev.keyCode === 27)  // escape
            closeModal();
    };
    $('#settings-overlay').addEventListener('click', closeModal);

    antialias.addEventListener('change', antialiasChanged);
    antialias.checked = config.antialias;
    unloadConfirmation.addEventListener('change', unloadConfirmationChanged);
    unloadConfirmation.checked = config.unloadConfirmation;
    synthSelect.addEventListener('change', synthSelectChanged);
    synthSelect.value = config.synthesizer;

    $('#downloadSaveData').addEventListener('click', downloadSaveData);
    $('#uploadSaveData').addEventListener('click', uploadSaveData);
}

function openModal() {
    $('#settings-modal').classList.add('active');
    document.addEventListener('keydown', keyDownHandler);
    saveDataManager = new SaveDataManager();
    checkSaveData();
}

function closeModal() {
    $('#settings-modal').classList.remove('active');
    document.removeEventListener('keydown', keyDownHandler);
    saveDataManager = null;
}

function antialiasChanged() {
    config.antialias = antialias.checked;
    config.persist();
    if (!$('#xsystem35').hidden)
        _ags_setAntialiasedStringMode(config.antialias ? 1 : 0);
}

function unloadConfirmationChanged() {
    config.unloadConfirmation = unloadConfirmation.checked;
    config.persist();
}

function synthSelectChanged() {
    let value = synthSelect.value;
    if (value != 'fm' && value != 'midi')
        throw `Unexpected synth select value "${value}"`;
    config.synthesizer = value;
    config.persist();
    if (!$('#xsystem35').hidden)
        _select_synthesizer(value === 'fm' ? 1 : 0);
}

export function disableSynthSelect() {
    synthSelect.value = 'midi';
    synthSelect.setAttribute('disabled', '');
}

async function checkSaveData() {
    if ($('#downloadSaveData').hasAttribute('disabled') &&
        await saveDataManager!.hasSaveData())
        $('#downloadSaveData').removeAttribute('disabled');
}

async function downloadSaveData() {
    saveDataManager!.download();
}

function uploadSaveData() {
    openFileInput().then((file) =>
        saveDataManager!.extract(file)).then(() =>
        checkSaveData());
}

init();
