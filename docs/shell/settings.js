// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
import { SaveDataManager } from './savedata.js';
import { openFileInput } from './widgets.js';
// Settings Dialog
const antialias = $('#antialias');
const unloadConfirmation = $('#unload-confirmation');
const messageSkipFlags = {
    '#msgskip-skip-unseen': 1,
    '#msgskip-stop-on-unseen': 2,
    '#msgskip-stop-on-menu': 4,
    '#msgskip-stop-on-click': 8,
};
let saveDataManager = null;
let keyDownHandler;
function init() {
    $('#settings-button').addEventListener('click', openModal);
    $('#settings-close').addEventListener('click', closeModal);
    keyDownHandler = (ev) => {
        if (ev.keyCode === 27) // escape
            closeModal();
    };
    $('#settings-overlay').addEventListener('click', closeModal);
    antialias.addEventListener('change', antialiasChanged);
    antialias.checked = config.antialias;
    unloadConfirmation.addEventListener('change', unloadConfirmationChanged);
    unloadConfirmation.checked = config.unloadConfirmation;
    for (const id in messageSkipFlags) {
        const e = $(id);
        e.addEventListener('change', messageSkipFlagChanged);
        e.checked = !!(config.messageSkipFlags & messageSkipFlags[id]);
    }
    $('#msgskip-stop-on-unseen').toggleAttribute('disabled', $('#msgskip-skip-unseen').checked);
    $('#downloadSaveData').addEventListener('click', downloadSaveData);
    $('#uploadSaveData').addEventListener('click', uploadSaveData);
    document.addEventListener('gamestart', onGameStart);
}
function onGameStart() {
    messageSkipFlagChanged(); // set the initial values
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
function messageSkipFlagChanged() {
    let flags = 0;
    for (const id in messageSkipFlags) {
        if ($(id).checked)
            flags |= messageSkipFlags[id];
    }
    $('#msgskip-stop-on-unseen').toggleAttribute('disabled', $('#msgskip-skip-unseen').checked);
    if (window['_msgskip_setFlags'])
        _msgskip_setFlags(flags, 0xffffffff);
    config.messageSkipFlags = flags;
    config.persist();
}
async function checkSaveData() {
    if ($('#downloadSaveData').hasAttribute('disabled') &&
        await saveDataManager.hasSaveData())
        $('#downloadSaveData').removeAttribute('disabled');
}
async function downloadSaveData() {
    saveDataManager.download();
}
function uploadSaveData() {
    openFileInput().then((file) => saveDataManager.extract(file)).then(() => checkSaveData());
}
init();
