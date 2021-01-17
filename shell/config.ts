// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

class Config {
    antialias = true;
    pixelate = false;
    unloadConfirmation = true;
    volume = 1;
    zoom = 'fit';
    messageSkipFlags = 2 | 4 | 8;  // STOP_ON_UNSEEN, STOP_ON_MENU, STOP_ON_CLICK

    constructor() {
        let json = localStorage.getItem('KichikuouWeb.Config');
        if (json) {
            let val = JSON.parse(json);
            if (val.antialias !== undefined) this.antialias = val.antialias;
            if (val.pixelate !== undefined) this.pixelate = val.pixelate;
            if (val.unloadConfirmation !== undefined) this.unloadConfirmation = val.unloadConfirmation;
            if (val.volume !== undefined) this.volume = val.volume;
            if (val.zoom !== undefined) this.zoom = val.zoom;
            if (val.messageSkipFlags != undefined) this.messageSkipFlags = val.messageSkipFlags;
        }
    }

    persist() {
        localStorage.setItem('KichikuouWeb.Config', JSON.stringify({
            antialias: this.antialias,
            pixelate: this.pixelate,
            unloadConfirmation: this.unloadConfirmation,
            volume: this.volume,
            zoom: this.zoom,
            messageSkipFlags: this.messageSkipFlags,
        }));
    }
}
export let config = new Config();
