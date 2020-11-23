// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

class Config {
    antialias = true;
    pixelate = false;
    synthesizer: 'fm' | 'midi' = 'fm';
    unloadConfirmation = true;
    volume = 1;
    zoom = 'fit';

    constructor() {
        let json = localStorage.getItem('KichikuouWeb.Config');
        if (json) {
            let val = JSON.parse(json);
            if (val.antialias !== undefined) this.antialias = val.antialias;
            if (val.pixelate !== undefined) this.pixelate = val.pixelate;
            if (val.synthesizer !== undefined) this.synthesizer = val.synthesizer;
            if (val.unloadConfirmation !== undefined) this.unloadConfirmation = val.unloadConfirmation;
            if (val.volume !== undefined) this.volume = val.volume;
            if (val.zoom !== undefined) this.zoom = val.zoom;
        }
    }

    persist() {
        localStorage.setItem('KichikuouWeb.Config', JSON.stringify({
            antialias: this.antialias,
            pixelate: this.pixelate,
            synthesizer: this.synthesizer,
            unloadConfirmation: this.unloadConfirmation,
            volume: this.volume,
            zoom: this.zoom,
        }));
    }
}
export let config = new Config();
