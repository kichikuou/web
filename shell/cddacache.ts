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
}
