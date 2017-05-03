namespace xsystem35 {
    export class Config {
        antialias = true;
        pixelate = false;
        volume = 1;
        zoom = 'fit';

        constructor() {
            let json = localStorage.getItem('KichikuouWeb.Config');
            if (json) {
                let val = JSON.parse(json);
                if (val.antialias !== undefined) this.antialias = val.antialias;
                if (val.pixelate !== undefined) this.pixelate = val.pixelate;
                if (val.volume !== undefined) this.volume = val.volume;
                if (val.zoom !== undefined) this.zoom = val.zoom;
            }
        }

        persist() {
            localStorage.setItem('KichikuouWeb.Config', JSON.stringify({
                antialias: this.antialias,
                pixelate: this.pixelate,
                volume: this.volume,
                zoom: this.zoom,
            }));
        }
    }
    export let config = new Config();
}
