// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="savedata.ts" />

namespace xsystem35 {
    // Settings Dialog
    export class Settings {
        private antialias: HTMLInputElement = <HTMLInputElement>$('#antialias');
        private unloadConfirmation: HTMLInputElement = <HTMLInputElement>$('#unload-confirmation');
        private saveDataManager: SaveDataManager;
        private keyDownHandler: (ev: KeyboardEvent) => void;

        constructor() {
            $('#settings-button').addEventListener('click', this.openModal.bind(this));
            $('#settings-close').addEventListener('click', this.closeModal.bind(this));
            this.keyDownHandler = (ev: KeyboardEvent) => {
                if (ev.keyCode === 27)  // escape
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

        private openModal() {
            $('#settings-modal').classList.add('active');
            document.addEventListener('keydown', this.keyDownHandler);
            this.saveDataManager = new SaveDataManager();
            this.checkSaveData();
        }

        private closeModal() {
            $('#settings-modal').classList.remove('active');
            document.removeEventListener('keydown', this.keyDownHandler);
            this.saveDataManager = null;
        }

        private antialiasChanged() {
            config.antialias = this.antialias.checked;
            config.persist();
            if (!$('#xsystem35').hidden)
                _ags_setAntialiasedStringMode(config.antialias ? 1 : 0);
        }

        private unloadConfirmationChanged() {
            config.unloadConfirmation = this.unloadConfirmation.checked;
            config.persist();
        }

        private async checkSaveData() {
            if ($('#downloadSaveData').hasAttribute('disabled') &&
                await this.saveDataManager.hasSaveData())
                $('#downloadSaveData').removeAttribute('disabled');
        }

        private async downloadSaveData() {
            this.saveDataManager.download();
        }

        private uploadSaveData() {
            openFileInput().then((file) =>
                this.saveDataManager.extract(file)).then(() =>
                this.checkSaveData());
        }
    }
}
