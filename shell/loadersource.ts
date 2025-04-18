// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, createBlob, DRIType } from './util.js';
import * as cdimage from './cdimage.js';
import {CDDALoader, BGMLoader} from './cddaloader.js';
import {registerDataFile} from './datafile.js';
import * as iso9660 from './iso9660.js';
import {loadModule, saveDirReady} from './moduleloader.js';
import {message} from './strings.js';
import * as zip from './zip.js';

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

    isReadyToLoad(): boolean {
        return true;
    }

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
        saveDirReady.then(() => { Module!.FS.mkdirTree(savedir.replace(/\/@$/, ''), undefined); });
    }

    protected async loadXsystem35() {
        await loadModule('xsystem35');
        Module!.arguments.push('-savedir', '/save');
    }

    protected addFile(fname: string, chunks: Uint8Array[]) {
        registerDataFile(fname, chunks);
        if (/M[A-Z]\.ALD$/i.test(fname)) {
            this.hasMidi = true;
        }
        if (/B[A-Z]\.ALD$/i.test(fname)) {
            this.hasBGM = true;
        }
    }
}

type CDImage = { image: File | undefined, metadata: File | undefined };
export class CDImageSource extends LoaderSource {
    private files: Map<string, CDImage> = new Map();
    private cddaReader!: cdimage.Reader;
    private patchFiles: File[] = [];

    addImageFile(file: File) {
        const basename = file.name.replace(/\.[^.]+$/, '').toLowerCase();
        if (this.files.has(basename)) {
            this.files.get(basename)!.image = file;
        } else {
            this.files.set(basename, { image: file, metadata: undefined });
        }
    }

    addMetadataFile(file: File) {
        const basename = file.name.replace(/\.[^.]+$/, '').toLowerCase();
        if (this.files.has(basename)) {
            this.files.get(basename)!.metadata = file;
        } else {
            this.files.set(basename, { image: undefined, metadata: file });
        }
    }

    addPatchFiles(files: File[]) {
        this.patchFiles.push(...files);
    }

    isReadyToLoad(): boolean {
        return this.files.size > 0 && Array.from(this.files.values()).every(i =>
            i.image && (i.metadata || i.image.name.toLowerCase().endsWith('.iso')));
    }

    protected async doLoad() {
        if (!this.isReadyToLoad()) {
            throw new Error('CDImageSource is not ready to load');
        }

        let engine: 'system3' | 'xsystem35' | undefined;
        for (let { image, metadata } of this.files.values()) {
            const imageReader = await cdimage.createReader(image!, metadata);
            if (!this.cddaReader || imageReader.maxTrack() > 1) {
                this.cddaReader = imageReader;
            }
            let isofs = await iso9660.FileSystem.create(imageReader);
            // this.walk(isofs, isofs.rootDir(), '/');
            let gamedata = await this.findGameDir(isofs);
            if (!gamedata)
                continue;

            if (!engine) {
                engine = (await isofs.getDirEnt('system3.exe', gamedata)) ? 'system3' : 'xsystem35';
                if (engine === 'system3') {
                    await this.loadSystem3(await this.saveDir(isofs));
                } else {
                    await this.loadXsystem35();
                }
            }

            for (let e of await isofs.readDir(gamedata)) {
                if (this.patchFiles.some((f) => f.name.toLowerCase() === e.name.toLowerCase()))
                    continue;
                if (engine === 'system3') {
                    if (!e.name.toLowerCase().endsWith('.dat'))
                        continue;
                } else {
                    if (e.name.match(/^\.|\.(exe|dll|txt|ini)$/i))
                        continue;
                }
                let chunks = await isofs.readFile(e);
                this.addFile(e.name, chunks);
            }
        }
        if (!engine) {
            throw new NoGamedataError(message.no_gamedata_dir);
        }
        for (let f of this.patchFiles) {
            let content = await f.arrayBuffer();
            this.addFile(f.name, [new Uint8Array(content)]);
        }
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this.cddaReader);
    }

    private async findGameDir(isofs: iso9660.FileSystem): Promise<iso9660.DirEnt | null> {
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

    private async saveDir(isofs: iso9660.FileSystem): Promise<string> {
        let dirname = isofs.volumeLabel();
        if (!dirname) {
            if (await isofs.getDirEnt('prog.bat', isofs.rootDir())) {
                dirname = 'ProG';
            } else if (await isofs.getDirEnt('dps_all.bat', isofs.rootDir())) {
                dirname = 'DPS_all';
            } else {  // Yakata 3?
                dirname = 'untitled';
            }
        }
        return '/save/' + dirname;
    }

    // For debug
    private async walk(isofs: iso9660.FileSystem, dir: iso9660.DirEnt, dirname: string) {
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
            this.addFile(f.name, [new Uint8Array(content)]);
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
    private tracks = new CDDATracks<zip.ZipFile>();

    constructor(private zipFile: File) {
        super();
    }

    protected async doLoad() {
        const files = await zip.load(this.zipFile);
        const dataFiles = files.filter(f => /\.(ald|ain|map|dat|mda|ttf|otf|ini|xsys35rc)$/i.test(f.name));
        if (dataFiles.length === 0) {
            const hdmImages = files.filter(f => /\.hdm$/i.test(f.name));
            if (hdmImages.length > 0) {
                return this.loadFloppyImages(hdmImages);
            }
            const msg = files.some(f => /\.(d88|dsk|xdf)$/i.test(f.name)) ?
                message.floppy_images_cant_be_used : message.no_ald_in_zip;
            throw new NoGamedataError(msg);
        }
        if (files.some(f => /adisk\.dat$/i.test(f.name))) {
            await this.loadSystem3('/save/@');
        } else if (files.some(f => /sa\.ald$/i.test(f.name))) {
            await this.loadXsystem35();
        } else {
            throw new NoGamedataError(message.no_ald_in_zip);
        }

        for (const f of dataFiles) {
            const content = await f.extract();
            const basename = f.name.split('/').pop()!;
            this.addFile(basename, [content]);
        }
        const playlist = files.find(f => /playlist.txt/i.test(f.name));
        if (playlist) {
            const text = new TextDecoder().decode(await playlist.extract());
            this.tracks.load_playlist(text);
        }
        for (const f of files.filter(f => /\.(wav|mp3|ogg)$/i.test(f.name))) {
            this.tracks.add(f, f.name);
        }
    }

    private async loadFloppyImages(floppies: zip.ZipFile[]) {
        // Dynamically import fdimage.js since it depends on relatively large modules.
        const {extractFDImage} = await import('./fdimage.js');
        await this.loadSystem3('/save/@');
        for (const floppy of floppies) {
            const img = await floppy.extract();
            await extractFDImage(img, (fname, contents) => {
                console.log(fname);
                this.addFile(fname, [contents]);
            });
        }
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    async extractTrack(track: number): Promise<Blob> {
        const zobj = this.tracks.get(track);
        const buf: ArrayBuffer = await zobj.extract();
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
            this.addFile(f.name, [f.content]);
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
        name = this.normalize(name);
        if (this.playlist) {
            const track = this.playlist.get(name);
            if (track) {
                this.tracks[track] = item;
                return true;
            }
        } else {
            // Try to match the track number in the filename.
            let match = /^(\d+).*\.(wav|mp3|ogg)$/i.exec(name) ||
                /(\d+)\.(wav|mp3|ogg)$/i.exec(name);
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
