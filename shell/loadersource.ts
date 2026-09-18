// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, basename, createBlob, DRIType } from './util.js';
import * as cdimage from './cdimage.js';
import {CDDALoader, BGMLoader} from './cddaloader.js';
import {detectEngine, isGameDataFile, registerDataFile} from './datafile.js';
import * as iso9660 from './iso9660.js';
import {loadModule, saveDirReady} from './moduleloader.js';
import {message} from './strings.js';
import * as zip from './zip.js';

export class NoGamedataError implements Error {
    public name = 'NoGamedataError';
    // `fileTypes` summarizes what the user actually gave us, for analytics.
    constructor(public message: string, public fileTypes?: string) {}

    toString() {
        return this.name + ': ' + this.message;
    }
}

// Returns the most common file extensions in `names`, like "exe:3,cab:2,-:1"
// ("-" being files without an extension). Kept short because GA4 truncates
// event parameters at 100 characters.
export function summarizeFileTypes(names: string[]): string {
    const counts = new Map<string, number>();
    for (const name of names) {
        const ext = /\.([^.]+)$/.exec(basename(name))?.[1].slice(0, 8).toLowerCase() || '-';
        counts.set(ext, (counts.get(ext) || 0) + 1);
    }
    return Array.from(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([ext, n]) => ext + ':' + n).join(',');
}

export type GameFileEntry = { name: string, load: () => Promise<Uint8Array[]> };

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

    protected async installGameFiles(entries: GameFileEntry[], sys3_savedir = '/save/@') {
        const engine = detectEngine(entries.map(e => e.name));
        if (!engine) {
            throw new NoGamedataError(message.no_gamedata, summarizeFileTypes(entries.map(e => e.name)));
        }
        if (engine === 'system3') {
            await this.loadSystem3(sys3_savedir);
        } else {
            await this.loadXsystem35();
        }
        for (const e of entries) {
            if (!isGameDataFile(engine, e.name)) {
                console.log('Skipping ' + e.name);
                continue;
            }
            this.addFile(e.name, await e.load());
        }
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

        const entries: GameFileEntry[] = [];
        let savedir: string | undefined;
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
            if (!savedir)
                savedir = await this.saveDir(isofs);

            for (let e of await isofs.readDir(gamedata)) {
                if (e.isDirectory)
                    continue;
                // Files dropped along with the image take precedence.
                if (this.patchFiles.some((f) => f.name.toLowerCase() === e.name.toLowerCase()))
                    continue;
                entries.push({ name: e.name, load: () => isofs.readFile(e) });
            }
        }
        if (!savedir) {
            throw new NoGamedataError(message.no_gamedata_dir);
        }
        for (let f of this.patchFiles) {
            entries.push({ name: f.name, load: async () => [new Uint8Array(await f.arrayBuffer())] });
        }
        await this.installGameFiles(entries, savedir);
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
        const playlist = this.files.find(f => f.name.toLowerCase() === 'playlist.txt');
        if (playlist) {
            this.tracks.load_playlist(await playlist.text());
        }
        const entries: GameFileEntry[] = [];
        for (let f of this.files) {
            if (this.tracks.add(f, f.name)) {
                continue;
            }
            entries.push({ name: f.name, load: async () => [new Uint8Array(await f.arrayBuffer())] });
        }
        await this.installGameFiles(entries);
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    hasAudioTrack(): boolean {
        return !this.tracks.is_empty();
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
        const playlist = files.find(f => /playlist\.txt$/i.test(f.name));
        if (playlist) {
            const text = new TextDecoder().decode(await playlist.extract());
            this.tracks.load_playlist(text);
        }
        const entries: GameFileEntry[] = [];
        for (const f of files) {
            if (f.name.endsWith('/'))
                continue;
            if (this.tracks.add(f, f.name)) {
                continue;
            }
            entries.push({ name: basename(f.name), load: async () => [await f.extract()] });
        }
        if (!detectEngine(entries.map(e => e.name))) {
            const hdmImages = files.filter(f => /\.hdm$/i.test(f.name));
            if (hdmImages.length > 0) {
                return this.loadFloppyImages(hdmImages);
            }
            throw new NoGamedataError(files.some(f => /\.(d88|dsk|xdf)$/i.test(f.name)) ?
                message.floppy_images_cant_be_used : message.no_gamedata,
                summarizeFileTypes(files.map(f => f.name)));
        }
        await this.installGameFiles(entries);
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

    hasAudioTrack(): boolean {
        return !this.tracks.is_empty();
    }

    async extractTrack(track: number): Promise<Blob> {
        const zobj = this.tracks.get(track);
        const buf = await zobj.extract();
        return createBlob(buf, zobj.name);
    }
}

type SevenZipSourceItem = { name: string, content: Uint8Array<ArrayBuffer> };
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
        const playlist = files.find(f => f.name.toLowerCase() === 'playlist.txt');
        if (playlist) {
            this.tracks.load_playlist(new TextDecoder().decode(playlist.content));
        }
        const entries: GameFileEntry[] = [];
        for (const f of files) {
            if (this.tracks.add(f, f.name)) {
                continue;
            }
            entries.push({ name: f.name, load: async () => [f.content] });
        }
        await this.installGameFiles(entries);
    }

    createCDDALoader(): CDDALoader {
        return new CDDALoader(this);
    }

    hasAudioTrack(): boolean {
        return !this.tracks.is_empty();
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

    is_empty(): boolean {
        return this.tracks.length === 0;
    }

    get(track: number): T {
        if (!this.tracks[track])
            throw new Error('Invalid track ' + track);
        return this.tracks[track];
    }
}
