// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$, startMeasure, mkdirIfNotExist, loadScript, JSZIP_SCRIPT, JSZipOptions, createBlob, DRIType} from './util.js';
import * as cdimage from './cdimage.js';
import {CDDALoader, BGMLoader} from './cddaloader.js';
import {registerDataFile} from './datafile.js';
import {loadModule, saveDirReady} from './moduleloader.js';
import {message} from './strings.js';

export class NoGamedataError implements Error {
    public name = 'NoGamedataError';
    constructor(public message: string) {}

    toString() {
        return this.name + ': ' + this.message;
    }
}

export abstract class LoaderSource {
    protected abstract createCDDALoader(): CDDALoader;
    protected abstract doLoad(): Promise<void>;

    public hasMidi = false;
    private hasBGM = false;

    async startLoad() {
        await this.doLoad();
    }

    getCDDALoader(): CDDALoader {
        if (this.hasBGM)
            return new CDDALoader(new BGMLoader(DRIType.BGM, 0));
        return this.createCDDALoader();
    }

    protected async loadSystem3(savedir: string) {
        await loadModule('system3');
        Module!.arguments.push('-savedir', savedir);
        saveDirReady.then(() => { mkdirIfNotExist(savedir.replace(/\/@$/, '')); });
    }

    protected async loadXsystem35() {
        await loadModule('xsystem35');
        Module!.arguments.push('-savedir', '/save');
    }

    protected addFile(fname: string, size: number, chunks: Uint8Array[]) {
        registerDataFile(fname, size, chunks);
        if (/M[A-Z]\.ALD$/i.test(fname)) {
            this.hasMidi = true;
        }
        if (/B[A-Z]\.ALD$/i.test(fname)) {
            this.hasBGM = true;
        }
    }
}

export class CDImageSource extends LoaderSource {
    private imageReader!: cdimage.Reader;

    constructor(private imageFile: File, private metadataFile: File | undefined, private patchFiles: File[]) {
        super();
    }

    protected async doLoad() {
        this.imageReader = await cdimage.createReader(this.imageFile, this.metadataFile);
        let isofs = await cdimage.ISO9660FileSystem.create(this.imageReader);
        // this.walk(isofs, isofs.rootDir(), '/');
        let gamedata = await this.findGameDir(isofs);
        if (!gamedata)
            throw new NoGamedataError(message.no_gamedata_dir);

        let isSystem3 = !!await isofs.getDirEnt('system3.exe', gamedata);
        if (isSystem3) {
            await this.loadSystem3(await this.saveDir(isofs));
        } else {
            await this.loadXsystem35();
        }

        let endMeasure = startMeasure('ImageLoad');
        for (let e of await isofs.readDir(gamedata)) {
            if (this.patchFiles.some((f) => f.name.toLowerCase() === e.name.toLowerCase()))
                continue;
            if (isSystem3) {
                if (!e.name.toLowerCase().endsWith('.dat'))
                    continue;
            } else {
                if (e.name.match(/^\.|\.(exe|dll|txt|ini)$/i))
                    continue;
            }
            let em = startMeasure(e.name);
            let chunks = await isofs.readFile(e);
            em();
            this.addFile(e.name, e.size, chunks);
        }
        for (let f of this.patchFiles) {
            let content = await f.arrayBuffer();
            this.addFile(f.name, f.size, [new Uint8Array(content)]);
        }
        endMeasure();
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this.imageReader);
    }

    private async findGameDir(isofs: cdimage.ISO9660FileSystem): Promise<cdimage.DirEnt | null> {
        for (let e of await isofs.readDir(isofs.rootDir())) {
            if (e.isDirectory) {
                if (e.name.toLowerCase() === 'gamedata' || await isofs.getDirEnt('adisk.dat', e))
                    return e;
            }
            if (e.name.toLowerCase() === 'adisk.dat')
                return isofs.rootDir();
        }
        return null;
    }

    private async saveDir(isofs: cdimage.ISO9660FileSystem): Promise<string> {
        let dirname = isofs.volumeLabel();
        if (!dirname) {
            if (await isofs.getDirEnt('prog.bat', isofs.rootDir())) {
                dirname = 'ProG';
            } else if (await isofs.getDirEnt('dps_all.bat', isofs.rootDir())) {
                dirname = 'DPS_all';
            } else {
                dirname = 'untitled';
                gtag('event', 'NoVolumeLabel', { event_category: 'Loader', event_label: this.imageFile.name });
            }
        }
        return '/save/' + dirname;
    }

    // For debug
    private async walk(isofs: cdimage.ISO9660FileSystem, dir: cdimage.DirEnt, dirname: string) {
        for (let e of await isofs.readDir(dir)) {
            if (e.name !== '.' && e.name !== '..') {
                console.log(dirname + e.name);
                if (e.isDirectory)
                    this.walk(isofs, e, dirname + e.name + '/');
            }
        }
    }
}

export class FileSource extends LoaderSource {
    private tracks = new CDDATracks<File>();
    private files: File[] = []

    constructor(fs: FileList | File[]) {
        super()
        for (let i = 0; i < fs.length; i++) {
            this.files.push(fs[i]);
        }
    }

    protected async doLoad() {
        if (this.files.some(f => f.name.toLowerCase() === 'adisk.dat')) {
            await this.loadSystem3('/save/@');
        } else {
            await this.loadXsystem35();
        }
        const playlist = this.files.find(f => f.name.toLowerCase() === 'playlist.txt');
        if (playlist) {
            this.tracks.load_playlist(await playlist.text());
        }
        for (let f of this.files) {
            if (this.tracks.add(f, f.name)) {
                continue;
            }
            let content = await f.arrayBuffer();
            this.addFile(f.name, f.size, [new Uint8Array(content)]);
        }
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    async extractTrack(track: number): Promise<Blob> {
        return this.tracks.get(track);
    }
}

export class ZipSource extends LoaderSource {
    private tracks = new CDDATracks<JSZipObject>();

    constructor(private zipFile: File) {
        super();
    }

    protected async doLoad() {
        await loadScript(JSZIP_SCRIPT);
        const zip = new JSZip();
        await zip.loadAsync(await this.zipFile.arrayBuffer(), JSZipOptions());

        const dataFiles = zip.file(/\.(ald|ain|map|dat|mda|ttf|otf|ini|xsys35rc)$/i);
        if (dataFiles.length === 0) {
            const hdmImages = zip.file(/\.hdm$/i);
            if (hdmImages.length > 0) {
                return this.loadFloppyImages(hdmImages);
            }
            const msg = zip.file(/\.(d88|dsk|xdf)$/i).length > 0 ?
                message.floppy_images_cant_be_used : message.no_ald_in_zip;
            throw new NoGamedataError(msg);
        }
        if (zip.file(/adisk.dat/i).length > 0) {
            await this.loadSystem3('/save/@');
        } else {
            await this.loadXsystem35();
        }

        for (const f of dataFiles) {
            const content: ArrayBuffer = await f.async('arraybuffer');
            const basename = f.name.split('/').pop()!;
            this.addFile(basename, content.byteLength, [new Uint8Array(content)]);
        }
        const playlist = zip.file(/playlist.txt/i);
        if (playlist.length > 0) {
            this.tracks.load_playlist(await playlist[0].async('text'));
        }
        for (const f of zip.file(/\.(wav|mp3|ogg)$/i)) {
            this.tracks.add(f, f.name);
        }
    }

    private async loadFloppyImages(floppies: JSZipObject[]) {
        // Dynamically import fdimage.js since it depends on relatively large modules.
        const {extractFDImage} = await import('./fdimage.js');
        await this.loadSystem3('/save/@');
        for (const floppy of floppies) {
            const img: ArrayBuffer = await floppy.async('arraybuffer');
            await extractFDImage(new Uint8Array(img), (fname, contents) => {
                console.log(fname);
                this.addFile(fname, contents.byteLength, [contents]);
            });
        }
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    async extractTrack(track: number): Promise<Blob> {
        const zobj = this.tracks.get(track);
        const buf: ArrayBuffer = await zobj.async('arraybuffer');
        return createBlob(buf, zobj.name);
    }
}

type SevenZipSourceItem = { name: string, content: Uint8Array };
type SevenZipWorkerResponse = { files: SevenZipSourceItem[] } | { error: string };
export class SevenZipSource extends LoaderSource {
    private tracks = new CDDATracks<SevenZipSourceItem>();

    constructor(private file: File) {
        super();
    }

    protected async doLoad() {
        const worker = new Worker('archiveworker.js', {type: 'module'});
        worker.postMessage({ file: this.file });
        $('#loader').classList.add('module-loading');  // Show the spinner
        const e = await new Promise<MessageEvent<SevenZipWorkerResponse>>((resolve) => {
            worker.addEventListener('message', (e) => resolve(e));
        });
        if ('error' in e.data) {
            $('#loader').classList.remove('module-loading');
            throw new Error(e.data.error);
        }
        const { files } = e.data;
        if (files.some(f => f.name.toLowerCase() === 'adisk.dat')) {
            await this.loadSystem3('/save/@');
        } else {
            await this.loadXsystem35();
        }

        const playlist = files.find(f => f.name.toLowerCase() === 'playlist.txt');
        if (playlist) {
            this.tracks.load_playlist(new TextDecoder().decode(playlist.content));
        }
        for (const f of files) {
            if (this.tracks.add(f, f.name)) {
                continue;
            }
            this.addFile(f.name, f.content.byteLength, [f.content]);
        }
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    async extractTrack(track: number): Promise<Blob> {
        let f = this.tracks.get(track);
        return createBlob(f.content, f.name);
    }
}

class CDDATracks<T> {
    private tracks: T[] = [];
    private playlist: Map<string, number> | undefined;

    private normalize(name: string) {
        return name.toLowerCase().trim().replace(/.*[\/\\]/, '');
    }

    load_playlist(playlist: string) {
        const lines = playlist.split('\n');
        this.playlist = new Map();
        for (let i = 0; i < lines.length; i++) {
            const line = this.normalize(lines[i]);
            if (line.length > 0) {
                this.playlist?.set(line, i + 1);
            }
        }
    }

    add(item: T, name: string): boolean {
        if (this.playlist) {
            const track = this.playlist.get(this.normalize(name));
            if (track) {
                this.tracks[track] = item;
                return true;
            }
        } else {
            let match = /(\d+)\.(wav|mp3|ogg)$/i.exec(name.toLowerCase());
            if (match) {
                this.tracks[Number(match[1])] = item;
                return true;
            }
        }
        return false;
    }

    get(track: number): T {
        if (!this.tracks[track])
            throw new Error('Invalid track ' + track);
        return this.tracks[track];
    }
}
