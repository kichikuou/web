// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, startMeasure, mkdirIfNotExist, readFileAsArrayBuffer, loadScript, isMobileSafari, JSZIP_SCRIPT, JSZipOptions } from './util.js';
import * as cdimage from './cdimage.js';
import { BasicCDDACache, IOSCDDACache } from './cddacache.js';
import { registerDataFile } from './datafile.js';
import { loadModule, saveDirReady } from './moduleloader.js';
import { message } from './strings.js';
export class NoGamedataError {
    constructor(message) {
        this.message = message;
        this.name = 'NoGamedataError';
    }
    toString() {
        return this.name + ': ' + this.message;
    }
}
export class LoaderSource {
    constructor() {
        this.hasMidi = false;
    }
    createGr(files) {
        const resourceType = {
            d: 'Data', g: 'Graphics', m: 'Midi', r: 'Resource', s: 'Scenario', w: 'Wave',
        };
        let basename = '';
        let lines = [];
        for (let name of files) {
            if (name.toLowerCase() === 'system39.ain') {
                lines.push('Ain ' + name);
                continue;
            }
            if (!name.toLowerCase().endsWith('.ald')) {
                continue;
            }
            let type = name.charAt(name.length - 6).toLowerCase();
            let id = name.charAt(name.length - 5);
            basename = name.slice(0, -6);
            if (!resourceType[type]) {
                console.log('Resource file of unknown type: ' + name);
                continue;
            }
            lines.push(resourceType[type] + id.toUpperCase() + ' ' + name);
            if (type == 'm')
                this.hasMidi = true;
        }
        for (let i = 0; i < 26; i++) {
            let id = String.fromCharCode(65 + i);
            lines.push('Save' + id + ' save/' + basename + 's' + id.toLowerCase() + '.asd');
        }
        lines.push(`MsgSkip save/${basename}.msgskip`);
        return lines.join('\n') + '\n';
    }
}
export class CDImageSource extends LoaderSource {
    constructor(imageFile, metadataFile, patchFiles) {
        super();
        this.imageFile = imageFile;
        this.metadataFile = metadataFile;
        this.patchFiles = patchFiles;
    }
    async startLoad() {
        this.imageReader = await cdimage.createReader(this.imageFile, this.metadataFile);
        this.cddaCache = isMobileSafari() ? new IOSCDDACache(this.imageReader) : new BasicCDDACache(this.imageReader);
        let isofs = await cdimage.ISO9660FileSystem.create(this.imageReader);
        // this.walk(isofs, isofs.rootDir(), '/');
        let gamedata = await this.findGameDir(isofs);
        if (!gamedata)
            throw new NoGamedataError(message.no_gamedata_dir);
        let isSystem3 = !!await isofs.getDirEnt('system3.exe', gamedata);
        await loadModule(isSystem3 ? 'system3' : 'xsystem35');
        let endMeasure = startMeasure('ImageLoad', 'Image load', this.imageFile.name);
        let aldFiles = [];
        for (let e of await isofs.readDir(gamedata)) {
            if (this.patchFiles.some((f) => f.name.toLowerCase() === e.name.toLowerCase()))
                continue;
            if (isSystem3) {
                if (!e.name.toLowerCase().endsWith('.dat'))
                    continue;
            }
            else {
                if (e.name.match(/^\.|\.(exe|dll|txt|ini)$/i))
                    continue;
                if (e.name.match(/\.(ald|ain)$/i))
                    aldFiles.push(e.name);
            }
            let em = startMeasure(e.name);
            let chunks = await isofs.readFile(e);
            em();
            registerDataFile(e.name, e.size, chunks);
        }
        for (let f of this.patchFiles) {
            let content = await readFileAsArrayBuffer(f);
            registerDataFile(f.name, f.size, [new Uint8Array(content)]);
            if (f.name.match(/\.(ald|ain)$/i))
                aldFiles.push(f.name);
        }
        if (isSystem3) {
            let savedir = await this.saveDir(isofs);
            Module.arguments.push('-savedir', savedir + '/');
            saveDirReady.then(() => { mkdirIfNotExist(savedir); });
        }
        else {
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        }
        endMeasure();
    }
    getCDDA(track) {
        return this.cddaCache.getCDDA(track);
    }
    async findGameDir(isofs) {
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
    async saveDir(isofs) {
        let dirname = isofs.volumeLabel();
        if (!dirname) {
            if (await isofs.getDirEnt('prog.bat', isofs.rootDir())) {
                dirname = 'ProG';
            }
            else if (await isofs.getDirEnt('dps_all.bat', isofs.rootDir())) {
                dirname = 'DPS_all';
            }
            else {
                dirname = 'untitled';
                ga('send', 'event', 'Loader', 'NoVolumeLabel');
            }
        }
        return '/save/' + dirname;
    }
    // For debug
    async walk(isofs, dir, dirname) {
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
    constructor(fs) {
        super();
        this.tracks = [];
        this.trackURLs = [];
        this.files = [];
        for (let i = 0; i < fs.length; i++) {
            this.files.push(fs[i]);
        }
    }
    async startLoad() {
        let aldFiles = [];
        let isSystem3 = this.files.some(f => f.name.toLowerCase() === 'adisk.dat');
        await loadModule(isSystem3 ? 'system3' : 'xsystem35');
        for (let f of this.files) {
            let match = /(\d+)\.(wav|mp3|ogg)$/.exec(f.name.toLowerCase());
            if (match) {
                this.tracks[Number(match[1])] = f;
                continue;
            }
            let content = await readFileAsArrayBuffer(f);
            registerDataFile(f.name, f.size, [new Uint8Array(content)]);
            if (f.name.match(/\.(ald|ain)$/i))
                aldFiles.push(f.name);
        }
        if (isSystem3) {
            Module.arguments.push('-savedir', '/save/@');
            saveDirReady.then(() => { mkdirIfNotExist('/save'); });
        }
        else {
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        }
    }
    async getCDDA(track) {
        if (!this.trackURLs[track]) {
            if (!this.tracks[track])
                throw new Error('FileSource: Invalid track ' + track);
            this.trackURLs[track] = URL.createObjectURL(this.tracks[track]);
        }
        return this.trackURLs[track];
    }
}
export class ZipSource extends LoaderSource {
    constructor(zipFile) {
        super();
        this.zipFile = zipFile;
        this.tracks = [];
        this.trackURLs = [];
    }
    async startLoad() {
        await loadScript(JSZIP_SCRIPT);
        const zip = new JSZip();
        await zip.loadAsync(await readFileAsArrayBuffer(this.zipFile), JSZipOptions());
        const dataFiles = zip.file(/\.(ald|ain|dat|mda|ttf|otf|ini|xsys35rc)$/i);
        if (dataFiles.length === 0)
            throw new NoGamedataError(message.no_ald_in_zip);
        const isSystem3 = zip.file(/adisk.dat/i).length > 0;
        await loadModule(isSystem3 ? 'system3' : 'xsystem35');
        const aldFiles = [];
        for (const f of dataFiles) {
            const content = await zip.files[f.name].async('arraybuffer');
            const basename = f.name.split('/').pop();
            registerDataFile(basename, content.byteLength, [new Uint8Array(content)]);
            aldFiles.push(basename);
        }
        for (const f of zip.file(/\d+\.(wav|mp3|ogg)$/i)) {
            const n = Number(/(\d+)\.\w+$/.exec(f.name)[1]);
            this.tracks[n] = f;
        }
        if (isSystem3) {
            Module.arguments.push('-savedir', '/save/@');
            saveDirReady.then(() => { mkdirIfNotExist('/save'); });
        }
        else {
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        }
    }
    async getCDDA(track) {
        if (!this.trackURLs[track]) {
            if (!this.tracks[track])
                throw new Error('ZipSource: Invalid track ' + track);
            const blob = await this.tracks[track].async('blob');
            this.trackURLs[track] = URL.createObjectURL(blob);
        }
        return this.trackURLs[track];
    }
}
export class SevenZipSource extends LoaderSource {
    constructor(file) {
        super();
        this.file = file;
        this.tracks = [];
        this.trackURLs = [];
    }
    async startLoad() {
        const worker = new Worker('worker/archiveworker.js');
        worker.postMessage({ file: this.file });
        $('#loader').classList.add('module-loading'); // Show the spinner
        const e = await new Promise((resolve) => {
            worker.addEventListener('message', (e) => resolve(e));
        });
        if ('error' in e.data) {
            $('#loader').classList.remove('module-loading');
            throw new Error(e.data.error);
        }
        const { files } = e.data;
        const isSystem3 = files.some(f => f.name.toLowerCase() === 'adisk.dat');
        await loadModule(isSystem3 ? 'system3' : 'xsystem35');
        const aldFiles = [];
        for (const f of files) {
            let match = /(\d+)\.(wav|mp3|ogg)$/i.exec(f.name);
            if (match) {
                this.tracks[Number(match[1])] = new Blob([f.content]);
                continue;
            }
            registerDataFile(f.name, f.content.byteLength, [f.content]);
            aldFiles.push(f.name);
        }
        if (isSystem3) {
            Module.arguments.push('-savedir', '/save/@');
            saveDirReady.then(() => { mkdirIfNotExist('/save'); });
        }
        else {
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        }
    }
    async getCDDA(track) {
        if (!this.trackURLs[track]) {
            if (!this.tracks[track])
                throw new Error('SevenZipSource: Invalid track ' + track);
            this.trackURLs[track] = URL.createObjectURL(this.tracks[track]);
        }
        return this.trackURLs[track];
    }
}
