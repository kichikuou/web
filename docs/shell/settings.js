// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
import { SaveDataManager } from './savedata.js';
import { openFileInput } from './widgets.js';
// Settings Dialog
class Settings {
    constructor() {
        this.antialias = $('#antialias');
        this.unloadConfirmation = $('#unload-confirmation');
        this.saveDataManager = null;
        $('#settings-button').addEventListener('click', this.openModal.bind(this));
        $('#settings-close').addEventListener('click', this.closeModal.bind(this));
        this.keyDownHandler = (ev) => {
            if (ev.keyCode === 27) // escape
                this.closeModal();
        };
        $('#settings-overlay').addEventListener('click', this.closeModal.bind(this));
        this.antialias.addEventListener('change', this.antialiasChanged.bind(this));
        this.antialias.checked = config.antialias;
        this.unloadConfirmation.addEventListener('change', this.unloadConfirmationChanged.bind(this));
        this.unloadConfirmation.checked = config.unloadConfirmation;
        $('#downloadSaveData').addEventListener('click', this.downloadSaveData.bind(this));
        $('#uploadSaveData').addEventListener('click', this.uploadSaveData.bind(this));
    }
    openModal() {
        $('#settings-modal').classList.add('active');
        document.addEventListener('keydown', this.keyDownHandler);
        this.saveDataManager = new SaveDataManager();
        this.checkSaveData();
    }
    closeModal() {
        $('#settings-modal').classList.remove('active');
        document.removeEventListener('keydown', this.keyDownHandler);
        this.saveDataManager = null;
    }
    antialiasChanged() {
        config.antialias = this.antialias.checked;
        config.persist();
        if (!$('#xsystem35').hidden)
            _ags_setAntialiasedStringMode(config.antialias ? 1 : 0);
    }
    unloadConfirmationChanged() {
        config.unloadConfirmation = this.unloadConfirmation.checked;
        config.persist();
    }
    async checkSaveData() {
        if ($('#downloadSaveData').hasAttribute('disabled') &&
            await this.saveDataManager.hasSaveData())
            $('#downloadSaveData').removeAttribute('disabled');
    }
    async downloadSaveData() {
        this.saveDataManager.download();
    }
    uploadSaveData() {
        openFileInput().then((file) => this.saveDataManager.extract(file)).then(() => this.checkSaveData());
    }
}
export let settings = new Settings();
