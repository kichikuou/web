// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, fileSystemReady, saveDirReady, startMeasure, mkdirIfNotExist, openFileInput, readFileAsArrayBuffer, loadScript, FontMincho, FontGothic, JSZIP_SCRIPT, JSZipOptions } from './util.js';
import * as CDImage from './cdimage.js';
import { registerDataFile } from './datafile.js';
import { toolbar } from './toolbar.js';
import { addToast } from './toast.js';
const xsys35rc = [
    'font_device: ttf',
    'ttfont_mincho: ' + FontMincho,
    'ttfont_gothic: ' + FontGothic, '',
].join('\n');
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
    reloadImage() {
        return Promise.resolve();
    }
    createGr(files) {
        const resourceType = {
            d: 'Data', g: 'Graphics', m: 'Midi', r: 'Resource', s: 'Scenario', w: 'Wave',
        };
        let basename;
        let lines = [];
        for (let name of files) {
            if (name.toLowerCase() === 'system39.ain') {
                lines.push('Ain ' + name);
                continue;
            }
            let type = name.charAt(name.length - 6).toLowerCase();
            let id = name.charAt(name.length - 5);
            basename = name.slice(0, -6);
            lines.push(resourceType[type] + id.toUpperCase() + ' ' + name);
            if (type == 'm')
                this.hasMidi = true;
        }
        for (let i = 0; i < 26; i++) {
            let id = String.fromCharCode(65 + i);
            lines.push('Save' + id + ' save/' + basename + 's' + id.toLowerCase() + '.asd');
        }
        return lines.join('\n') + '\n';
    }
}
export class CDImageSource extends LoaderSource {
    constructor(imageFile, metadataFile) {
        super();
        this.imageFile = imageFile;
        this.metadataFile = metadataFile;
    }
    async startLoad() {
        this.imageReader = await CDImage.createReader(this.imageFile, this.metadataFile);
        let isofs = await CDImage.ISO9660FileSystem.create(this.imageReader);
        // this.walk(isofs, isofs.rootDir(), '/');
        let gamedata = await this.findGameDir(isofs);
        if (!gamedata)
            throw new NoGamedataError('イメージ内にGAMEDATAフォルダが見つかりません。');
        let isSystem3 = !!await isofs.getDirEnt('system3.exe', gamedata);
        await loadModule(isSystem3 ? 'system3' : 'xsystem35');
        let endMeasure = startMeasure('ImageLoad', 'Image load', this.imageFile.name);
        let aldFiles = [];
        for (let e of await isofs.readDir(gamedata)) {
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
        if (isSystem3) {
            let savedir = await this.saveDir(isofs);
            Module.arguments.push('-savedir', savedir + '/');
            saveDirReady.then(() => { mkdirIfNotExist(savedir); });
        }
        else {
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
            FS.writeFile('.xsys35rc', xsys35rc);
        }
        endMeasure();
    }
    getCDDA(track) {
        return this.imageReader.extractTrack(track);
    }
    reloadImage() {
        return openFileInput().then((file) => {
            this.imageReader.resetImage(file);
        });
    }
    async findGameDir(isofs) {
        for (let e of await isofs.readDir(isofs.rootDir())) {
            if (e.isDirectory) {
                if (e.name.toLowerCase() === 'gamedata' || await isofs.getDirEnt('system3.exe', e))
                    return e;
            }
            if (e.name.toLowerCase() === 'system3.exe')
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
    constructor(files) {
        super();
        this.files = files;
        this.tracks = [];
    }
    async startLoad() {
        await loadModule('xsystem35');
        let aldFiles = [];
        for (let i = 0; i < this.files.length; i++) {
            let f = this.files[i];
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
        FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        FS.writeFile('.xsys35rc', xsys35rc);
    }
    getCDDA(track) {
        return Promise.resolve(this.tracks[track]);
    }
}
export class ZipSource extends LoaderSource {
    constructor(zipFile) {
        super();
        this.zipFile = zipFile;
        this.tracks = [];
    }
    async startLoad() {
        await loadScript(JSZIP_SCRIPT);
        let zip = new JSZip();
        await zip.loadAsync(await readFileAsArrayBuffer(this.zipFile), JSZipOptions());
        let aldFiles = [];
        for (let name in zip.files) {
            let match = /(\d+)\.(wav|mp3|ogg)$/.exec(name.toLowerCase());
            if (match) {
                this.tracks[Number(match[1])] = zip.files[name];
                continue;
            }
            if (!name.match(/\.(ald|ain)$/i))
                continue;
            if (aldFiles.length === 0)
                await loadModule('xsystem35');
            let content = await zip.files[name].async('arraybuffer');
            let basename = name.split('/').pop();
            registerDataFile(basename, content.byteLength, [new Uint8Array(content)]);
            aldFiles.push(basename);
        }
        if (aldFiles.length === 0)
            throw new NoGamedataError('ZIP内にゲームデータ (*.ALDファイル) が見つかりません。');
        FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
        FS.writeFile('.xsys35rc', xsys35rc);
    }
    getCDDA(track) {
        return this.tracks[track].async('blob');
    }
}
function loadModule(name) {
    $('#loader').classList.add('module-loading');
    let src = name + '.js';
    let script = document.createElement('script');
    script.src = src;
    script.onerror = () => {
        ga('send', 'event', 'Game', 'ModuleLoadFailed', src);
        addToast(src + 'の読み込みに失敗しました。リロードしてください。', 'error');
    };
    document.body.appendChild(script);
    let endMeasure = startMeasure('ModuleLoad', 'Module load', src);
    return fileSystemReady.then(() => {
        endMeasure();
        $('#loader').hidden = true;
        document.body.classList.add('bgblack-fade');
        toolbar.setCloseable();
    });
}
