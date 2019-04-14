namespace xsystem35 {
    export interface CDDACache {
        getCDDA(track: number): Promise<Blob>;
    }

    export class BasicCDDACache implements CDDACache {
        private blobCache: Blob[];

        constructor(private loader: Loader) {
            this.blobCache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }

        async getCDDA(track: number): Promise<Blob> {
            if (this.blobCache[track])
                return this.blobCache[track];
            let blob = await this.loader.getCDDA(track);
            this.blobCache[track] = blob;
            return blob;
        }

        private onVisibilityChange() {
            if (document.hidden)
                this.blobCache = [];
        }
    }

    export class IOSCDDACache implements CDDACache {
        private cache: {track: number, data: Blob, time: number}[];

        constructor(private loader: Loader) {
            this.cache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }

        async getCDDA(track: number): Promise<Blob> {
            for (let entry of this.cache) {
                if (entry.track === track) {
                    entry.time = performance.now();
                    return entry.data;
                }
            }
            this.shrink(2);
            let blob = await this.loader.getCDDA(track);
            try {
                let buf = await readFileAsArrayBuffer(blob);
                blob = new Blob([buf], { type: 'audio/wav' });
                this.cache.unshift({track, data: blob, time: performance.now()});
                return blob;
            } catch (e) {
                gaException({type: 'CDDAload', name: e.constructor.name, code: e.code});
                let clone = document.importNode((<HTMLTemplateElement>$('#cdda-error')).content, true);
                let toast = xsystem35.shell.addToast(clone, 'error');
                return new Promise(resolve => {
                    toast.querySelector('.cdda-reload-button').addEventListener('click', () => {
                        this.loader.reloadImage().then(() => {
                            (<HTMLElement>toast.querySelector('.btn-clear')).click();
                            resolve(this.getCDDA(track));
                        });
                    });
                });
            }
        }

        private shrink(size: number) {
            if (this.cache.length <= size)
                return;
            this.cache.sort((a, b) => b.time - a.time);
            this.cache.length = size;
        }

        private onVisibilityChange() {
            if (document.hidden)
                this.shrink(1);
        }
    }
}
