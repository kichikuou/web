// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
const $ = document.querySelector.bind(document);
const JSZIP_SCRIPT = 'lib/jszip.3.1.3.min.js';
const scriptPromises = new Map();
function loadScript(src) {
    let p = scriptPromises.get(src);
    if (!p) {
        let e = document.createElement('script');
        e.src = src;
        p = new Promise((resolve, reject) => {
            e.addEventListener('load', resolve, { once: true });
            e.addEventListener('error', reject, { once: true });
        });
        document.body.appendChild(e);
        scriptPromises.set(src, p);
    }
    return p;
}
function readFileAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}
function readFileAsText(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsText(blob);
    });
}
function ASCIIArrayToString(buffer) {
    return String.fromCharCode.apply(null, buffer);
}
function openFileInput() {
    return new Promise((resolve) => {
        let input = document.createElement('input');
        input.type = 'file';
        input.addEventListener('change', (evt) => {
            document.body.removeChild(input);
            resolve(input.files[0]);
        });
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    });
}
function mkdirIfNotExist(path, fs) {
    try {
        (fs || FS).mkdir(path);
    }
    catch (err) {
        // ignore EEXIST
    }
}
function isIOSVersionBetween(from, to) {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return from <= ver && ver < to;
}
function JSZipOptions() {
    let opts = {};
    if (typeof TextDecoder !== 'undefined')
        opts = { decodeFileName };
    return opts;
    function decodeFileName(bytes) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        catch (err) {
            return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        }
    }
}
function startMeasure(name, gaName, gaParam) {
    let startMark = name + '-start';
    let endMark = name + '-end';
    performance.mark(startMark);
    return () => {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        if (gaName) {
            let duration = performance.getEntriesByName(name)[0].duration;
            ga('send', 'timing', gaName, gaParam, Math.round(duration));
        }
    };
}
function gaException(description, exFatal = false) {
    let exDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return { DOMException: value.name, message: value.message };
        }
        return value;
    });
    ga('send', 'exception', { exDescription, exFatal });
}
var xsystem35;
(function (xsystem35) {
    let Status;
    (function (Status) {
        Status[Status["OK"] = 0] = "OK";
        Status[Status["NG"] = -1] = "NG";
    })(Status = xsystem35.Status || (xsystem35.Status = {}));
    let Bool;
    (function (Bool) {
        Bool[Bool["FALSE"] = 0] = "FALSE";
        Bool[Bool["TRUE"] = 1] = "TRUE";
    })(Bool = xsystem35.Bool || (xsystem35.Bool = {}));
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
var xsystem35;
(function (xsystem35) {
    class Config {
        constructor() {
            this.antialias = true;
            this.pixelate = false;
            this.unloadConfirmation = true;
            this.volume = 1;
            this.zoom = 'fit';
            let json = localStorage.getItem('KichikuouWeb.Config');
            if (json) {
                let val = JSON.parse(json);
                if (val.antialias !== undefined)
                    this.antialias = val.antialias;
                if (val.pixelate !== undefined)
                    this.pixelate = val.pixelate;
                if (val.unloadConfirmation !== undefined)
                    this.unloadConfirmation = val.unloadConfirmation;
                if (val.volume !== undefined)
                    this.volume = val.volume;
                if (val.zoom !== undefined)
                    this.zoom = val.zoom;
            }
        }
        persist() {
            localStorage.setItem('KichikuouWeb.Config', JSON.stringify({
                antialias: this.antialias,
                pixelate: this.pixelate,
                unloadConfirmation: this.unloadConfirmation,
                volume: this.volume,
                zoom: this.zoom,
            }));
        }
    }
    xsystem35.Config = Config;
    xsystem35.config = new Config();
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
var CDImage;
(function (CDImage) {
    class ISO9660FileSystem {
        constructor(sectorReader, vd) {
            this.sectorReader = sectorReader;
            this.vd = vd;
            this.decoder = new TextDecoder(vd.encoding());
        }
        static async create(sectorReader) {
            let best_vd = null;
            for (let sector = 0x10;; sector++) {
                let vd = new VolumeDescriptor(await sectorReader.readSector(sector));
                switch (vd.type) {
                    case VDType.Primary:
                        if (!best_vd)
                            best_vd = vd;
                        break;
                    case VDType.Supplementary:
                        if (vd.encoding())
                            best_vd = vd;
                        break;
                    case VDType.Terminator:
                        if (!best_vd)
                            throw new Error('PVD not found');
                        return new ISO9660FileSystem(sectorReader, best_vd);
                }
            }
        }
        volumeLabel() {
            return this.vd.volumeLabel(this.decoder);
        }
        rootDir() {
            return this.vd.rootDirEnt(this.decoder);
        }
        async getDirEnt(name, parent) {
            name = name.toLowerCase();
            for (let e of await this.readDir(parent)) {
                if (e.name.toLowerCase() === name)
                    return e;
            }
            return null;
        }
        async readDir(dirent) {
            let sector = dirent.sector;
            let position = 0;
            let length = dirent.size;
            let entries = [];
            let buf;
            while (position < length) {
                if (position === 0)
                    buf = await this.sectorReader.readSector(sector);
                let child = new DirEnt(buf, position, this.decoder);
                if (child.length === 0) {
                    // Padded end of sector
                    position = 2048;
                }
                else {
                    entries.push(child);
                    position += child.length;
                }
                if (position > 2048)
                    throw new Error('dirent across sector boundary');
                if (position === 2048) {
                    sector++;
                    position = 0;
                    length -= 2048;
                }
            }
            return entries;
        }
        readFile(dirent) {
            return this.sectorReader.readSequentialSectors(dirent.sector, dirent.size);
        }
    }
    CDImage.ISO9660FileSystem = ISO9660FileSystem;
    let VDType;
    (function (VDType) {
        VDType[VDType["Primary"] = 1] = "Primary";
        VDType[VDType["Supplementary"] = 2] = "Supplementary";
        VDType[VDType["Terminator"] = 255] = "Terminator";
    })(VDType || (VDType = {}));
    class VolumeDescriptor {
        constructor(buf) {
            this.buf = buf;
            this.view = new DataView(buf);
            if (ASCIIArrayToString(new Uint8Array(this.buf, 1, 5)) !== 'CD001')
                throw new Error('Not a valid CD image');
        }
        get type() {
            return this.view.getUint8(0);
        }
        volumeLabel(decoder) {
            return decoder.decode(new DataView(this.buf, 40, 32)).trim();
        }
        encoding() {
            if (this.type === VDType.Primary)
                return 'shift_jis';
            if (this.escapeSequence().match(/%\/[@CE]/))
                return 'utf-16be'; // Joliet
            return null;
        }
        escapeSequence() {
            return ASCIIArrayToString(new Uint8Array(this.buf, 88, 32)).trim();
        }
        rootDirEnt(decoder) {
            return new DirEnt(this.buf, 156, decoder);
        }
    }
    class DirEnt {
        constructor(buf, offset, decoder) {
            this.buf = buf;
            this.offset = offset;
            this.decoder = decoder;
            this.view = new DataView(buf, offset);
        }
        get length() {
            return this.view.getUint8(0);
        }
        get sector() {
            return this.view.getUint32(2, true);
        }
        get size() {
            return this.view.getUint32(10, true);
        }
        get isDirectory() {
            return (this.view.getUint8(25) & 2) !== 0;
        }
        get name() {
            let len = this.view.getUint8(32);
            let name = new DataView(this.buf, this.offset + 33, len);
            if (len === 1) {
                switch (name.getUint8(0)) {
                    case 0:
                        return '.';
                    case 1:
                        return '..';
                }
            }
            return this.decoder.decode(name).split(';')[0];
        }
    }
    CDImage.DirEnt = DirEnt;
    async function createReader(img, metadata) {
        if (img.name.endsWith('.iso')) {
            return new IsoReader(img);
        }
        else if (metadata.name.endsWith('.cue')) {
            let reader = new ImgCueReader(img);
            await reader.parseCue(metadata);
            return reader;
        }
        else if (metadata.name.endsWith('.ccd')) {
            let reader = new ImgCueReader(img);
            await reader.parseCcd(metadata);
            return reader;
        }
        else {
            let reader = new MdfMdsReader(img);
            await reader.parseMds(metadata);
            return reader;
        }
    }
    CDImage.createReader = createReader;
    class ImageReaderBase {
        constructor(image) {
            this.image = image;
        }
        async readSequential(startOffset, bytesToRead, blockSize, sectorSize, sectorOffset) {
            let sectors = Math.ceil(bytesToRead / sectorSize);
            let blob = this.image.slice(startOffset, startOffset + sectors * blockSize);
            let buf = await readFileAsArrayBuffer(blob);
            let bufs = [];
            for (let i = 0; i < sectors; i++) {
                bufs.push(new Uint8Array(buf, i * blockSize + sectorOffset, Math.min(bytesToRead, sectorSize)));
                bytesToRead -= sectorSize;
            }
            return bufs;
        }
        resetImage(image) {
            this.image = image;
        }
    }
    class IsoReader extends ImageReaderBase {
        readSector(sector) {
            return readFileAsArrayBuffer(this.image.slice(sector * 2048, (sector + 1) * 2048));
        }
        async readSequentialSectors(startSector, length) {
            let start = startSector * 2048;
            let buf = await readFileAsArrayBuffer(this.image.slice(start, start + length));
            return [new Uint8Array(buf)];
        }
        maxTrack() {
            return 1;
        }
        extractTrack(track) {
            throw 'not implemented';
        }
    }
    class ImgCueReader extends ImageReaderBase {
        constructor(img) {
            super(img);
        }
        readSector(sector) {
            let start = sector * 2352 + 16;
            let end = start + 2048;
            return readFileAsArrayBuffer(this.image.slice(start, end));
        }
        readSequentialSectors(startSector, length) {
            return this.readSequential(startSector * 2352, length, 2352, 2048, 16);
        }
        async parseCue(cueFile) {
            let lines = (await readFileAsText(cueFile)).split('\n');
            this.tracks = [];
            let currentTrack = null;
            for (let line of lines) {
                let fields = line.trim().split(/\s+/);
                switch (fields[0]) {
                    case 'TRACK':
                        currentTrack = Number(fields[1]);
                        this.tracks[currentTrack] = { isAudio: fields[2] === 'AUDIO', index: [] };
                        break;
                    case 'INDEX':
                        if (currentTrack)
                            this.tracks[currentTrack].index[Number(fields[1])] = this.indexToSector(fields[2]);
                        break;
                    default:
                    // Do nothing
                }
            }
        }
        async parseCcd(ccdFile) {
            let lines = (await readFileAsText(ccdFile)).split('\n');
            this.tracks = [];
            let currentTrack = null;
            for (let line of lines) {
                line = line.trim();
                let match = line.match(/\[TRACK ([0-9]+)\]/);
                if (match) {
                    currentTrack = Number(match[1]);
                    this.tracks[currentTrack] = { isAudio: undefined, index: [] };
                    continue;
                }
                if (!currentTrack)
                    continue;
                let keyval = line.split(/=/);
                switch (keyval[0]) {
                    case 'MODE':
                        this.tracks[currentTrack].isAudio = keyval[1] === '0';
                        break;
                    case 'INDEX 0':
                        this.tracks[currentTrack].index[0] = Number(keyval[1]);
                        break;
                    case 'INDEX 1':
                        this.tracks[currentTrack].index[1] = Number(keyval[1]);
                        break;
                    default:
                    // Do nothing
                }
            }
        }
        maxTrack() {
            return this.tracks.length - 1;
        }
        async extractTrack(track) {
            if (!this.tracks[track] || !this.tracks[track].isAudio)
                return;
            let start = this.tracks[track].index[1] * 2352;
            let end;
            if (this.tracks[track + 1]) {
                let index = this.tracks[track + 1].index[0] || this.tracks[track + 1].index[1];
                end = index * 2352;
            }
            else {
                end = this.image.size;
            }
            let size = end - start;
            let pcm = this.image.slice(start, start + size);
            if (navigator.userAgent.match(/Firefox\/6[234]/)) {
                console.log('Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1514581');
                pcm = await readFileAsArrayBuffer(pcm);
            }
            return new Blob([createWaveHeader(size), pcm], { type: 'audio/wav' });
        }
        indexToSector(index) {
            let msf = index.split(':').map(Number);
            return msf[0] * 60 * 75 + msf[1] * 75 + msf[2];
        }
    }
    let MdsTrackMode;
    (function (MdsTrackMode) {
        MdsTrackMode[MdsTrackMode["Audio"] = 169] = "Audio";
        MdsTrackMode[MdsTrackMode["Mode1"] = 170] = "Mode1";
    })(MdsTrackMode || (MdsTrackMode = {}));
    class MdfMdsReader extends ImageReaderBase {
        constructor(mdf) {
            super(mdf);
        }
        async parseMds(mdsFile) {
            let buf = await readFileAsArrayBuffer(mdsFile);
            let signature = ASCIIArrayToString(new Uint8Array(buf, 0, 16));
            if (signature !== 'MEDIA DESCRIPTOR')
                throw new Error(mdsFile.name + ': not a mds file');
            let header = new DataView(buf, 0, 0x70);
            let entries = header.getUint8(0x62);
            if (0x70 + entries * 0x58 > buf.byteLength)
                throw new Error(mdsFile.name + ': unknown format');
            this.tracks = [];
            for (let i = 0; i < entries; i++) {
                let trackData = new DataView(buf, 0x70 + i * 0x50, 0x50);
                let extraData = new DataView(buf, 0x70 + entries * 0x50 + i * 8, 8);
                let mode = trackData.getUint8(0x00);
                let track = trackData.getUint8(0x04);
                let sectorSize = trackData.getUint16(0x10, true);
                let offset = trackData.getUint32(0x28, true); // >4GB offset is not supported.
                let sectors = extraData.getUint32(0x4, true);
                if (track < 100)
                    this.tracks[track] = { mode, sectorSize, offset, sectors };
            }
            if (this.tracks[1].mode !== MdsTrackMode.Mode1)
                throw new Error('track 1 is not mode1');
        }
        readSector(sector) {
            let start = sector * this.tracks[1].sectorSize + 16;
            let end = start + 2048;
            return readFileAsArrayBuffer(this.image.slice(start, end));
        }
        readSequentialSectors(startSector, length) {
            let track = this.tracks[1];
            return this.readSequential(track.offset + startSector * track.sectorSize, length, track.sectorSize, 2048, 16);
        }
        maxTrack() {
            return this.tracks.length - 1;
        }
        async extractTrack(track) {
            if (!this.tracks[track] || this.tracks[track].mode !== MdsTrackMode.Audio)
                return;
            let size = this.tracks[track].sectors * 2352;
            let chunks = await this.readSequential(this.tracks[track].offset, size, this.tracks[track].sectorSize, 2352, 0);
            return new Blob([createWaveHeader(size)].concat(chunks), { type: 'audio/wav' });
        }
    }
    function createWaveHeader(size) {
        let buf = new ArrayBuffer(44);
        let view = new DataView(buf);
        view.setUint32(0, 0x52494646, false); // 'RIFF'
        view.setUint32(4, size + 36, true); // filesize - 8
        view.setUint32(8, 0x57415645, false); // 'WAVE'
        view.setUint32(12, 0x666D7420, false); // 'fmt '
        view.setUint32(16, 16, true); // size of fmt chunk
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 2, true); // stereo
        view.setUint32(24, 44100, true); // sampling rate
        view.setUint32(28, 176400, true); // bytes/sec
        view.setUint16(32, 4, true); // block size
        view.setUint16(34, 16, true); // bit/sample
        view.setUint32(36, 0x64617461, false); // 'data'
        view.setUint32(40, size, true); // data size
        return buf;
    }
})(CDImage || (CDImage = {}));
var xsystem35;
(function (xsystem35) {
    const major = 240;
    let entryCount = 0;
    // See xsystem35-sdl2/patch/README.TXT
    const PastelChimePatch = [
        [0x1c68, 0x54, 0x47]
    ];
    const TADAModePatch = [
        [0x0087b, 0x40, 0x41],
        [0x01b79, 0x40, 0x41],
        [0x16e5f, 0x24, 0x40],
        [0x16e60, 0xae, 0x92],
        [0x16e61, 0x06, 0x05]
    ];
    function registerDataFile(fname, size, chunks) {
        let patch = null;
        ;
        switch (fname.toUpperCase()) {
            case 'ぱすてるSA.ALD':
                patch = PastelChimePatch;
                break;
            case '鬼畜王SA.ALD':
                if (xsystem35.urlParams.get('tada') === '1')
                    patch = TADAModePatch;
                break;
        }
        let dev = FS.makedev(major, entryCount++);
        let ops = new NodeOps(size, chunks, patch);
        FS.registerDevice(dev, ops);
        FS.mkdev('/' + fname, dev);
    }
    xsystem35.registerDataFile = registerDataFile;
    class NodeOps {
        constructor(size, chunks, patchTbl) {
            this.size = size;
            this.chunks = chunks;
            this.patchTbl = patchTbl;
        }
        read(stream, buffer, offset, length, position) {
            if (buffer !== Module.HEAP8)
                throw new Error('Invalid argument');
            if (this.addr === undefined)
                this.load();
            let src = this.addr + position;
            length = Math.min(length, this.size - position);
            // load() might have invalidated `buffer`, so use Module.HEAP8 directly
            Module.HEAP8.set(Module.HEAPU8.subarray(src, src + length), offset);
            return length;
        }
        llseek(stream, offset, whence) {
            let position = offset;
            if (whence === 1) // SEEK_CUR
                position += stream.position;
            else if (whence === 2) // SEEK_END
                position += this.size;
            return position;
        }
        mmap() {
            if (this.addr === undefined)
                this.load();
            return { ptr: this.addr, allocated: false };
        }
        load() {
            let ptr = this.addr = Module._malloc(this.size);
            for (let c of this.chunks) {
                Module.HEAPU8.set(c, ptr);
                ptr += c.byteLength;
            }
            this.chunks = null;
            this.patch();
        }
        patch() {
            if (!this.patchTbl)
                return;
            for (let a of this.patchTbl) {
                if (Module.HEAPU8[this.addr + a[0]] !== a[1]) {
                    console.log('Patch failed');
                    return;
                }
            }
            for (let a of this.patchTbl)
                Module.HEAPU8[this.addr + a[0]] = a[2];
            console.log('Patch applied');
            this.patchTbl = null;
        }
    }
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="cdimage.ts" />
/// <reference path="datafile.ts" />
var xsystem35;
(function (xsystem35) {
    class NoGamedataError {
        constructor(message) {
            this.message = message;
            this.name = 'NoGamedataError';
        }
        toString() {
            return this.name + ': ' + this.message;
        }
    }
    xsystem35.NoGamedataError = NoGamedataError;
    class LoaderSource {
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
    xsystem35.LoaderSource = LoaderSource;
    class CDImageSource extends LoaderSource {
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
            await xsystem35.shell.loadModule(isSystem3 ? 'system3' : 'xsystem35');
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
                xsystem35.registerDataFile(e.name, e.size, chunks);
            }
            if (isSystem3) {
                let savedir = await this.saveDir(isofs);
                Module.arguments.push('-savedir', savedir + '/');
                xsystem35.saveDirReady.then(() => { mkdirIfNotExist(savedir); });
            }
            else {
                FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
                FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
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
    xsystem35.CDImageSource = CDImageSource;
    class FileSource extends LoaderSource {
        constructor(files) {
            super();
            this.files = files;
            this.tracks = [];
        }
        async startLoad() {
            await xsystem35.shell.loadModule('xsystem35');
            let aldFiles = [];
            for (let i = 0; i < this.files.length; i++) {
                let f = this.files[i];
                let match = /(\d+)\.(wav|mp3|ogg)$/.exec(f.name.toLowerCase());
                if (match) {
                    this.tracks[Number(match[1])] = f;
                    continue;
                }
                let content = await readFileAsArrayBuffer(f);
                xsystem35.registerDataFile(f.name, f.size, [new Uint8Array(content)]);
                if (f.name.match(/\.(ald|ain)$/i))
                    aldFiles.push(f.name);
            }
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
            FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
        }
        getCDDA(track) {
            return Promise.resolve(this.tracks[track]);
        }
    }
    xsystem35.FileSource = FileSource;
    class ZipSource extends LoaderSource {
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
                    await xsystem35.shell.loadModule('xsystem35');
                let content = await zip.files[name].async('arraybuffer');
                let basename = name.split('/').pop();
                xsystem35.registerDataFile(basename, content.byteLength, [new Uint8Array(content)]);
                aldFiles.push(basename);
            }
            if (aldFiles.length === 0)
                throw new NoGamedataError('ZIP内にゲームデータ (*.ALDファイル) が見つかりません。');
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
            FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
        }
        getCDDA(track) {
            return this.tracks[track].async('blob');
        }
    }
    xsystem35.ZipSource = ZipSource;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="loadersource.ts" />
var xsystem35;
(function (xsystem35) {
    class Loader {
        constructor(shell) {
            this.shell = shell;
            this.installing = false;
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }
        getCDDA(track) {
            return this.source.getCDDA(track);
        }
        reloadImage() {
            return this.source.reloadImage();
        }
        handleFileSelect(evt) {
            let input = evt.target;
            this.handleFiles(input.files);
            input.value = '';
        }
        handleDragOver(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            evt.dataTransfer.dropEffect = 'copy';
        }
        handleDrop(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            this.handleFiles(evt.dataTransfer.files);
        }
        async handleFiles(files) {
            if (this.installing || files.length === 0)
                return;
            let hasALD = false;
            let recognized = false;
            for (let file of files) {
                if (this.isImageFile(file)) {
                    this.imageFile = file;
                    $('#imgReady').classList.remove('notready');
                    $('#imgReady').textContent = file.name;
                    recognized = true;
                }
                else if (this.isMetadataFile(file)) {
                    this.metadataFile = file;
                    $('#cueReady').classList.remove('notready');
                    $('#cueReady').textContent = file.name;
                    recognized = true;
                }
                else if (file.name.toLowerCase().endsWith('.ald')) {
                    hasALD = true;
                }
                else if (file.name.toLowerCase().endsWith('.rar')) {
                    this.shell.addToast('展開前のrarファイルは読み込めません。', 'warning');
                    recognized = true;
                }
            }
            if (this.imageFile && (this.metadataFile || this.imageFile.name.toLowerCase().endsWith('.iso'))) {
                this.source = new xsystem35.CDImageSource(this.imageFile, this.metadataFile);
            }
            else if (!this.imageFile && !this.metadataFile) {
                if (files.length == 1 && files[0].name.toLowerCase().endsWith('.zip')) {
                    this.source = new xsystem35.ZipSource(files[0]);
                }
                else if (hasALD) {
                    this.source = new xsystem35.FileSource(files);
                }
            }
            if (!this.source) {
                if (!recognized)
                    this.shell.addToast(files[0].name + ' は認識できない形式です。', 'warning');
                return;
            }
            this.installing = true;
            try {
                await this.source.startLoad();
                this.shell.loaded(this.source.hasMidi);
            }
            catch (err) {
                if (err instanceof xsystem35.NoGamedataError) {
                    ga('send', 'event', 'Loader', 'NoGamedata', err.message);
                    this.shell.addToast('インストールできません。' + err.message, 'warning');
                }
                else {
                    ga('send', 'event', 'Loader', 'LoadFailed', err.message);
                    this.shell.addToast('インストールできません。認識できない形式です。', 'warning');
                }
                this.source = null;
            }
            this.installing = false;
        }
        isImageFile(file) {
            let name = file.name.toLowerCase();
            return name.endsWith('.img') || name.endsWith('.mdf') || name.endsWith('.iso');
        }
        isMetadataFile(file) {
            let name = file.name.toLowerCase();
            return name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds');
        }
    }
    xsystem35.Loader = Loader;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
var xsystem35;
(function (xsystem35) {
    class SaveDataManager {
        constructor() {
            if (window.FS)
                this.FSready = xsystem35.saveDirReady;
            if (!this.FSready) {
                this.FSready = loadScript('fslib.js').then(() => FSLib().saveDirReady);
            }
            loadScript(JSZIP_SCRIPT);
        }
        hasSaveData() {
            function find(fs, dir) {
                if (!fs.isDir(fs.stat(dir).mode))
                    return false;
                for (let name of fs.readdir(dir)) {
                    if (name[0] === '.')
                        continue;
                    if (name.toLowerCase().endsWith('.asd') || name.toLowerCase().endsWith('.dat'))
                        return true;
                    if (find(fs, dir + '/' + name))
                        return true;
                }
                return false;
            }
            return this.FSready.then((fs) => find(fs, '/save'));
        }
        async download() {
            await loadScript(JSZIP_SCRIPT);
            let zip = new JSZip();
            storeZip(await this.FSready, '/save', zip.folder('save'));
            let blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            if (navigator.msSaveBlob) { // Edge
                navigator.msSaveBlob(blob, 'savedata.zip');
            }
            else {
                let elem = document.createElement('a');
                elem.setAttribute('download', 'savedata.zip');
                elem.setAttribute('href', URL.createObjectURL(blob));
                document.body.appendChild(elem);
                elem.click();
                setTimeout(() => { document.body.removeChild(elem); }, 5000);
            }
            ga('send', 'event', 'Savedata', 'Downloaded');
        }
        async extract(file) {
            try {
                let fs = await this.FSready;
                if (file.name.toLowerCase().endsWith('.asd')) {
                    addSaveFile(fs, '/save/' + file.name, await readFileAsArrayBuffer(file));
                }
                else {
                    await loadScript(JSZIP_SCRIPT);
                    let zip = new JSZip();
                    await zip.loadAsync(await readFileAsArrayBuffer(file), JSZipOptions());
                    let entries = [];
                    zip.folder('save').forEach((path, z) => { entries.push(z); });
                    for (let z of entries) {
                        if (z.dir)
                            mkdirIfNotExist('/' + z.name.slice(0, -1), fs);
                        else
                            addSaveFile(fs, '/' + z.name, await z.async('arraybuffer'));
                    }
                }
                await new Promise((resolve, reject) => {
                    fs.syncfs(false, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                xsystem35.shell.addToast('セーブデータの復元に成功しました。', 'success');
                ga('send', 'event', 'Savedata', 'Restored');
            }
            catch (err) {
                xsystem35.shell.addToast('セーブデータを復元できませんでした。', 'error');
                ga('send', 'event', 'Savedata', 'RestoreFailed', err.message);
                console.warn(err);
                ga('send', 'exception', { exDescription: err.stack, exFatal: false });
            }
        }
    }
    xsystem35.SaveDataManager = SaveDataManager;
    function storeZip(fs, dir, zip) {
        for (let name of fs.readdir(dir)) {
            let path = dir + '/' + name;
            if (name[0] === '.') {
                continue;
            }
            else if (fs.isDir(fs.stat(path).mode)) {
                storeZip(fs, path, zip.folder(name));
            }
            else if (!name.toLowerCase().endsWith('.asd.')) {
                let content = fs.readFile(path, { encoding: 'binary' });
                zip.file(name, content);
            }
        }
    }
    function addSaveFile(fs, path, content) {
        fs.writeFile(path, new Uint8Array(content), { encoding: 'binary' });
    }
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="savedata.ts" />
var xsystem35;
(function (xsystem35) {
    // Settings Dialog
    class Settings {
        constructor() {
            this.antialias = $('#antialias');
            this.unloadConfirmation = $('#unload-confirmation');
            $('#settings-button').addEventListener('click', this.openModal.bind(this));
            $('#settings-close').addEventListener('click', this.closeModal.bind(this));
            this.keyDownHandler = (ev) => {
                if (ev.keyCode === 27) // escape
                    this.closeModal();
            };
            $('.modal-overlay').addEventListener('click', this.closeModal.bind(this));
            this.antialias.addEventListener('change', this.antialiasChanged.bind(this));
            this.antialias.checked = xsystem35.config.antialias;
            this.unloadConfirmation.addEventListener('change', this.unloadConfirmationChanged.bind(this));
            this.unloadConfirmation.checked = xsystem35.config.unloadConfirmation;
            $('#downloadSaveData').addEventListener('click', this.downloadSaveData.bind(this));
            $('#uploadSaveData').addEventListener('click', this.uploadSaveData.bind(this));
        }
        openModal() {
            $('#settings-modal').classList.add('active');
            document.addEventListener('keydown', this.keyDownHandler);
            this.saveDataManager = new xsystem35.SaveDataManager();
            this.checkSaveData();
        }
        closeModal() {
            $('#settings-modal').classList.remove('active');
            document.removeEventListener('keydown', this.keyDownHandler);
            this.saveDataManager = null;
        }
        antialiasChanged() {
            xsystem35.config.antialias = this.antialias.checked;
            xsystem35.config.persist();
            if (!$('#xsystem35').hidden)
                _ags_setAntialiasedStringMode(xsystem35.config.antialias ? 1 : 0);
        }
        unloadConfirmationChanged() {
            xsystem35.config.unloadConfirmation = this.unloadConfirmation.checked;
            xsystem35.config.persist();
        }
        async checkSaveData() {
            if ($('#downloadSaveData').hasAttribute('disabled') &&
                await this.saveDataManager.hasSaveData())
                $('#downloadSaveData').removeAttribute('disabled');
        }
        async downloadSaveData() {
            this.saveDataManager.download();
        }
        uploadSaveData() {
            openFileInput().then((file) => this.saveDataManager.extract(file)).then(() => this.checkSaveData());
        }
    }
    xsystem35.Settings = Settings;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="config.ts" />
var xsystem35;
(function (xsystem35) {
    class ZoomManager {
        constructor() {
            this.canvas = $('#canvas');
            this.zoomSelect = $('#zoom');
            this.pixelateCheckbox = $('#pixelate');
            this.throttling = false;
            this.zoomSelect.addEventListener('change', this.handleZoom.bind(this));
            this.zoomSelect.value = xsystem35.config.zoom;
            if (CSS.supports('image-rendering', 'pixelated') || CSS.supports('image-rendering', '-moz-crisp-edges')) {
                this.pixelateCheckbox.addEventListener('change', this.handlePixelate.bind(this));
                if (xsystem35.config.pixelate) {
                    this.pixelateCheckbox.checked = true;
                    this.handlePixelate();
                }
            }
            else {
                this.pixelateCheckbox.setAttribute('disabled', 'true');
            }
            if (screen.orientation) {
                screen.orientation.addEventListener('change', () => {
                    if (screen.orientation.type.startsWith('landscape'))
                        this.requestFullscreen();
                    else
                        this.exitFullscreen();
                });
            }
            window.addEventListener('resize', this.onResize.bind(this));
        }
        handleZoom() {
            let value = this.zoomSelect.value;
            xsystem35.config.zoom = value;
            xsystem35.config.persist();
            let navbarStyle = $('.navbar').style;
            if (value === 'fit') {
                $('#xsystem35').classList.add('fit');
                navbarStyle.maxWidth = 'none';
                this.canvas.style.width = null;
            }
            else {
                $('#xsystem35').classList.remove('fit');
                let ratio = Number(value);
                navbarStyle.maxWidth = this.canvas.style.width = this.canvas.width * ratio + 'px';
            }
        }
        onResize() {
            if (this.throttling)
                return;
            this.throttling = true;
            window.requestAnimationFrame(() => {
                this.recalcAspectRatio();
                this.throttling = false;
            });
        }
        recalcAspectRatio() {
            let container = $('.contents');
            let target = $('#xsystem35');
            let containerAspect = container.offsetWidth / container.offsetHeight;
            if (!containerAspect)
                return;
            let canvasAspect = this.canvas.width / this.canvas.height;
            if (containerAspect < canvasAspect) {
                target.classList.add('letterbox');
                target.classList.remove('pillarbox');
            }
            else {
                target.classList.remove('letterbox');
                target.classList.add('pillarbox');
            }
        }
        handlePixelate() {
            xsystem35.config.pixelate = this.pixelateCheckbox.checked;
            xsystem35.config.persist();
            if (this.pixelateCheckbox.checked)
                this.canvas.classList.add('pixelated');
            else
                this.canvas.classList.remove('pixelated');
        }
        requestFullscreen() {
            let e = document.documentElement;
            if (e.requestFullscreen)
                e.requestFullscreen();
            else if (e.webkitRequestFullScreen)
                e.webkitRequestFullScreen();
        }
        exitFullscreen() {
            if (document.exitFullscreen) {
                if (document.fullscreenElement)
                    document.exitFullscreen();
            }
            else if (document.webkitExitFullscreen) {
                if (document.webkitFullscreenElement)
                    document.webkitExitFullscreen();
            }
        }
    }
    xsystem35.ZoomManager = ZoomManager;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="config.ts" />
var xsystem35;
(function (xsystem35) {
    class VolumeControl {
        constructor() {
            this.vol = xsystem35.config.volume;
            this.muted = false;
            this.elem = $('#volume-control');
            this.icon = $('#volume-control-icon');
            this.slider = $('#volume-control-slider');
            this.slider.value = String(Math.round(this.vol * 100));
            this.icon.addEventListener('click', this.onIconClicked.bind(this));
            this.slider.addEventListener('input', this.onSliderValueChanged.bind(this));
            this.slider.addEventListener('change', this.onSliderValueSettled.bind(this));
            if (typeof (webkitAudioContext) !== 'undefined') {
                this.audioContext = new webkitAudioContext();
                this.removeUserGestureRestriction();
            }
            else {
                this.audioContext = new AudioContext();
            }
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.addEventListener(this.onVolumeChanged.bind(this));
            this.masterGain.gain.value = this.volume();
        }
        audioNode() {
            return this.masterGain;
        }
        removeUserGestureRestriction() {
            let handler = () => {
                let src = this.audioContext.createBufferSource();
                src.buffer = this.audioContext.createBuffer(1, 1, 22050);
                src.connect(this.audioContext.destination);
                src.start();
                console.log('AudioContext unlocked');
                window.removeEventListener('touchend', handler);
                window.removeEventListener('mouseup', handler);
            };
            window.addEventListener('touchend', handler);
            window.addEventListener('mouseup', handler);
        }
        volume() {
            return this.muted ? 0 : parseInt(this.slider.value, 10) / 100;
        }
        addEventListener(handler) {
            this.elem.addEventListener('volumechange', handler);
        }
        hideSlider() {
            this.slider.hidden = true;
        }
        suspendForModalDialog() {
            this.audioContext.suspend();
            setTimeout(() => this.audioContext.resume(), 0);
        }
        onIconClicked(e) {
            this.muted = !this.muted;
            if (this.muted) {
                this.icon.classList.remove('fa-volume-up');
                this.icon.classList.add('fa-volume-off');
                this.slider.value = '0';
            }
            else {
                this.icon.classList.remove('fa-volume-off');
                this.icon.classList.add('fa-volume-up');
                this.slider.value = String(Math.round(this.vol * 100));
            }
            this.dispatchEvent();
        }
        onSliderValueChanged(e) {
            this.vol = parseInt(this.slider.value, 10) / 100;
            if (this.vol > 0 && this.muted) {
                this.muted = false;
                this.icon.classList.remove('fa-volume-off');
                this.icon.classList.add('fa-volume-up');
            }
            this.dispatchEvent();
        }
        onSliderValueSettled(e) {
            xsystem35.config.volume = this.vol;
            xsystem35.config.persist();
        }
        dispatchEvent() {
            let event = new CustomEvent('volumechange', { detail: this.volume() });
            this.elem.dispatchEvent(event);
        }
        onVolumeChanged(evt) {
            this.masterGain.gain.value = evt.detail;
        }
    }
    xsystem35.VolumeControl = VolumeControl;
})(xsystem35 || (xsystem35 = {}));
/// <reference path="util.ts" />
var xsystem35;
(function (xsystem35) {
    class BasicCDDACache {
        constructor(loader) {
            this.loader = loader;
            this.blobCache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }
        async getCDDA(track) {
            if (this.blobCache[track])
                return this.blobCache[track];
            let blob = await this.loader.getCDDA(track);
            this.blobCache[track] = blob;
            return blob;
        }
        onVisibilityChange() {
            if (document.hidden)
                this.blobCache = [];
        }
    }
    xsystem35.BasicCDDACache = BasicCDDACache;
    class IOSCDDACache {
        constructor(loader) {
            this.loader = loader;
            this.cache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }
        async getCDDA(track) {
            for (let entry of this.cache) {
                if (entry.track === track) {
                    entry.time = performance.now();
                    return entry.data;
                }
            }
            this.shrink(3);
            let blob = await this.loader.getCDDA(track);
            try {
                let buf = await readFileAsArrayBuffer(blob);
                blob = new Blob([buf], { type: 'audio/wav' });
                this.cache.unshift({ track, data: blob, time: performance.now() });
                return blob;
            }
            catch (e) {
                if (e.constructor.name === 'FileError' && e.code === 1)
                    ga('send', 'event', 'CDDAload', 'NOT_FOUND_ERR');
                else
                    gaException({ type: 'CDDAload', name: e.constructor.name, code: e.code });
                let clone = document.importNode($('#cdda-error').content, true);
                if (this.reloadToast && this.reloadToast.parentElement)
                    this.reloadToast.querySelector('.btn-clear').click();
                this.reloadToast = xsystem35.shell.addToast(clone, 'error');
                return new Promise(resolve => {
                    this.reloadToast.querySelector('.cdda-reload-button').addEventListener('click', () => {
                        this.loader.reloadImage().then(() => {
                            ga('send', 'event', 'CDDAload', 'reloaded');
                            this.reloadToast.querySelector('.btn-clear').click();
                            resolve(this.getCDDA(track));
                        });
                    });
                });
            }
        }
        shrink(size) {
            if (this.cache.length <= size)
                return;
            this.cache.sort((a, b) => b.time - a.time);
            this.cache.length = size;
        }
        onVisibilityChange() {
            if (document.hidden)
                this.shrink(1);
        }
    }
    xsystem35.IOSCDDACache = IOSCDDACache;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="volume.ts" />
/// <reference path="cddacache.ts" />
var xsystem35;
(function (xsystem35) {
    class CDPlayer {
        constructor(loader, volumeControl) {
            this.audio = $('audio');
            // Volume control of <audio> is not supported in iOS
            this.audio.volume = 0.5;
            this.isVolumeSupported = this.audio.volume !== 1;
            this.cddaCache = this.isVolumeSupported ? new xsystem35.BasicCDDACache(loader) : new xsystem35.IOSCDDACache(loader);
            volumeControl.addEventListener(this.onVolumeChanged.bind(this));
            this.audio.volume = volumeControl.volume();
            this.audio.addEventListener('error', this.onAudioError.bind(this));
            this.removeUserGestureRestriction(true);
            if (!this.isVolumeSupported) {
                volumeControl.hideSlider();
                if (this.audio.volume === 0)
                    this.unmute = () => { };
            }
        }
        play(track, loop) {
            this.currentTrack = track;
            if (this.unmute) {
                this.unmute = () => { this.play(track, loop); };
                return;
            }
            this.audio.currentTime = 0;
            this.cddaCache.getCDDA(track).then((blob) => {
                if (blob) {
                    this.startPlayback(blob, loop);
                }
                else {
                    ga('send', 'event', 'CDDA', 'InvalidTrack');
                }
            });
        }
        stop() {
            this.audio.pause();
            this.currentTrack = null;
            if (this.unmute)
                this.unmute = () => { };
        }
        getPosition() {
            if (!this.currentTrack)
                return 0;
            let time = Math.round(this.audio.currentTime * 75);
            if (this.unmute || this.audio.error)
                time += 750; // unblock Kichikuou OP
            return this.currentTrack | time << 8;
        }
        startPlayback(blob, loop) {
            this.audio.setAttribute('src', URL.createObjectURL(blob));
            this.audio.loop = (loop !== 0);
            this.audio.load();
            let p = this.audio.play(); // Edge returns undefined
            if (p instanceof Promise) {
                p.catch((err) => {
                    if (err.message.startsWith('The play() request was interrupted') || // Chrome
                        err.name === 'AbortError') { // Safari
                        // These errors are harmless, do nothing
                    }
                    else if (err.name === 'NotAllowedError' || err.message.indexOf('gesture') >= 0) {
                        // Audio still locked?
                        this.removeUserGestureRestriction(false);
                        ga('send', 'event', 'CDDA', 'UnlockAgain');
                    }
                    else {
                        let { name, message } = err;
                        gaException({ type: 'CDDA', name, message });
                    }
                });
            }
        }
        onVolumeChanged(evt) {
            if (this.isVolumeSupported) {
                this.audio.volume = evt.detail;
                return;
            }
            let muted = evt.detail === 0;
            if (!!this.unmute === muted)
                return;
            if (muted) {
                this.audio.pause();
                this.unmute = () => { this.audio.play(); };
            }
            else {
                let unmute = this.unmute;
                this.unmute = null;
                unmute();
            }
        }
        onAudioError(err) {
            let { code, message } = this.audio.error;
            gaException({ type: 'Audio', code, message });
        }
        removeUserGestureRestriction(firstTime) {
            let hanlder = () => {
                if (!firstTime) {
                    this.audio.play();
                }
                else if (!this.currentTrack) {
                    this.audio.load();
                    console.log('CDDA unlocked');
                }
                window.removeEventListener('touchend', hanlder);
                window.removeEventListener('mouseup', hanlder);
            };
            window.addEventListener('touchend', hanlder);
            window.addEventListener('mouseup', hanlder);
        }
    }
    xsystem35.CDPlayer = CDPlayer;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
var xsystem35;
(function (xsystem35) {
    class MIDIPlayer {
        constructor() {
            this.playing = false;
            this.fadeFinishTime = 0;
            this.stopTimer = null;
        }
        init(destNode) {
            Module.addRunDependency('timidity');
            loadScript('/timidity/timidity.js').then(() => {
                Module.removeRunDependency('timidity');
                this.gain = destNode.context.createGain();
                this.gain.connect(destNode);
                this.timidity = new Timidity(this.gain, '/timidity/');
                this.timidity.on('playing', this.onPlaying.bind(this));
                this.timidity.on('error', this.onError.bind(this));
                this.timidity.on('ended', this.onEnd.bind(this));
            });
        }
        play(loop, data, datalen) {
            if (!this.timidity)
                return;
            this.timidity.load(Module.HEAPU8.slice(data, data + datalen));
            this.timidity.play();
            this.playing = true;
            // NOTE: `loop` is ignored.
        }
        stop() {
            if (!this.timidity)
                return;
            this.playing = false;
            this.timidity.pause();
        }
        pause() {
            if (!this.timidity)
                return;
            this.timidity.pause();
        }
        resume() {
            if (!this.timidity)
                return;
            this.timidity.play();
        }
        getPosition() {
            if (!this.timidity)
                return 0;
            return Math.round(this.timidity.currentTime * 1000);
        }
        setVolume(vol) {
            if (!this.timidity)
                return;
            this.gain.gain.value = vol / 100;
        }
        getVolume() {
            if (!this.timidity)
                return 100;
            return this.gain.gain.value * 100;
        }
        fadeStart(ms, vol, stop) {
            if (!this.timidity)
                return;
            // Cancel previous fade
            this.gain.gain.cancelScheduledValues(this.gain.context.currentTime);
            if (this.stopTimer !== null) {
                clearTimeout(this.stopTimer);
                this.stopTimer = null;
            }
            // Resetting the volume while not playing?
            if (ms === 0 && vol === 100 && (this.stopTimer || !this.playing)) {
                // No worries, playback always starts with volume 100%
                return;
            }
            this.gain.gain.linearRampToValueAtTime(vol / 100, this.gain.context.currentTime + ms / 1000);
            this.fadeFinishTime = performance.now() + ms;
            if (stop) {
                if (ms === 0)
                    this.stop();
                else {
                    this.stopTimer = setTimeout(() => {
                        this.stop();
                        this.stopTimer = null;
                    }, ms);
                }
            }
        }
        isFading() {
            if (!this.timidity)
                return 0;
            return performance.now() < this.fadeFinishTime ? 1 : 0;
        }
        onPlaying(playbackTime) {
            if (!playbackTime)
                return;
            // Reset volume to 100% at the start of playback
            this.gain.gain.setValueAtTime(1, playbackTime);
        }
        onError() {
            console.log('onError');
        }
        onEnd() {
            if (this.playing)
                this.timidity.play();
        }
    }
    xsystem35.MIDIPlayer = MIDIPlayer;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
var xsystem35;
(function (xsystem35) {
    class AudioManager {
        constructor(destNode) {
            this.destNode = destNode;
            this.slots = [];
            this.bufCache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }
        load(no) {
            let buf = this.getWave(no);
            if (!buf)
                return Promise.reject('Failed to open wave ' + no);
            // If the AudioContext was not created inside a user-initiated event
            // handler, then it will be suspended. Attempt to resume it.
            this.destNode.context.resume();
            let decoded;
            if (typeof (webkitAudioContext) !== 'undefined') { // Safari
                decoded = new Promise((resolve, reject) => {
                    this.destNode.context.decodeAudioData(buf, resolve, reject);
                });
            }
            else {
                decoded = this.destNode.context.decodeAudioData(buf);
            }
            return decoded.then((audioBuf) => {
                this.bufCache[no] = audioBuf;
                return audioBuf;
            });
        }
        getWave(no) {
            let dfile = _ald_getdata(2 /* DRIFILE_WAVE */, no - 1);
            if (!dfile)
                return null;
            let ptr = Module.getValue(dfile + 8, '*');
            let size = Module.getValue(dfile, 'i32');
            let buf = Module.HEAPU8.buffer.slice(ptr, ptr + size);
            _ald_freedata(dfile);
            return buf;
        }
        pcm_load(slot, no) {
            return Asyncify.handleSleep((wakeUp) => {
                this.pcm_stop(slot);
                if (this.bufCache[no]) {
                    this.slots[slot] = new PCMSoundSimple(this.destNode, this.bufCache[no]);
                    return wakeUp(xsystem35.Status.OK);
                }
                this.load(no).then((audioBuf) => {
                    this.slots[slot] = new PCMSoundSimple(this.destNode, audioBuf);
                    wakeUp(xsystem35.Status.OK);
                }).catch((err) => {
                    gaException({ type: 'PCM', err });
                    wakeUp(xsystem35.Status.NG);
                });
            });
        }
        pcm_load_mixlr(slot, noL, noR) {
            return Asyncify.handleSleep((wakeUp) => {
                this.pcm_stop(slot);
                if (this.bufCache[noL] && this.bufCache[noR]) {
                    this.slots[slot] = new PCMSoundMixLR(this.destNode, this.bufCache[noL], this.bufCache[noR]);
                    return wakeUp(xsystem35.Status.OK);
                }
                let ps = [
                    this.bufCache[noL] ? Promise.resolve(this.bufCache[noL]) : this.load(noL),
                    this.bufCache[noR] ? Promise.resolve(this.bufCache[noR]) : this.load(noR),
                ];
                Promise.all(ps).then((bufs) => {
                    this.slots[slot] = new PCMSoundMixLR(this.destNode, bufs[0], bufs[1]);
                    wakeUp(xsystem35.Status.OK);
                }).catch((err) => {
                    gaException({ type: 'PCM', err });
                    wakeUp(xsystem35.Status.NG);
                });
            });
        }
        pcm_unload(slot) {
            if (!this.slots[slot])
                return xsystem35.Status.NG;
            this.slots[slot].stop();
            this.slots[slot] = null;
            return xsystem35.Status.OK;
        }
        pcm_start(slot, loop) {
            if (this.slots[slot]) {
                this.slots[slot].start(loop);
                return xsystem35.Status.OK;
            }
            console.log('pcm_start: invalid slot', slot);
            return xsystem35.Status.NG;
        }
        pcm_stop(slot) {
            if (!this.slots[slot])
                return xsystem35.Status.NG;
            this.slots[slot].stop();
            if (slot === 0) // slot 0 plays at most once
                this.slots[slot] = null;
            return xsystem35.Status.OK;
        }
        pcm_fadeout(slot, msec) {
            if (!this.slots[slot])
                return xsystem35.Status.NG;
            this.slots[slot].fadeout(msec);
            return xsystem35.Status.OK;
        }
        pcm_getpos(slot) {
            if (!this.slots[slot])
                return 0;
            return this.slots[slot].getPosition() * 1000;
        }
        pcm_setvol(slot, vol) {
            if (!this.slots[slot])
                return xsystem35.Status.NG;
            this.slots[slot].setGain(vol / 100);
            return xsystem35.Status.OK;
        }
        pcm_getwavelen(slot) {
            if (!this.slots[slot])
                return 0;
            return this.slots[slot].duration * 1000;
        }
        pcm_isplaying(slot) {
            if (!this.slots[slot])
                return xsystem35.Bool.FALSE;
            return this.slots[slot].isPlaying() ? xsystem35.Bool.TRUE : xsystem35.Bool.FALSE;
        }
        pcm_waitend(slot) {
            return Asyncify.handleSleep((wakeUp) => {
                if (!this.slots[slot] || !this.slots[slot].isPlaying())
                    return wakeUp(xsystem35.Status.OK);
                this.slots[slot].end_callback = () => wakeUp(xsystem35.Status.OK);
            });
        }
        onVisibilityChange() {
            if (document.hidden)
                this.bufCache = [];
        }
    }
    xsystem35.AudioManager = AudioManager;
    class PCMSound {
        constructor(dst) {
            this.dst = dst;
            this.context = dst.context;
            this.gain = this.context.createGain();
            this.gain.connect(dst);
        }
        setGain(gain) {
            this.gain.gain.value = gain;
        }
        fadeout(msec) {
            this.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + msec / 1000);
        }
        getPosition() {
            if (!this.startTime)
                return 0;
            return this.context.currentTime - this.startTime;
        }
        isPlaying() {
            return !!this.startTime;
        }
        ended() {
            this.startTime = null;
            if (this.end_callback) {
                this.end_callback();
                this.end_callback = null;
            }
        }
    }
    class PCMSoundSimple extends PCMSound {
        constructor(dst, buf) {
            super(dst);
            this.buf = buf;
        }
        start(loop) {
            this.node = this.context.createBufferSource();
            this.node.buffer = this.buf;
            this.node.connect(this.gain);
            this.node.onended = this.onended.bind(this);
            if (loop !== 1)
                this.node.loop = true;
            if (loop <= 1)
                this.node.start();
            else
                this.node.start(0, 0, this.buf.duration * loop);
            this.startTime = this.context.currentTime;
        }
        stop() {
            if (this.startTime) {
                this.node.stop();
                this.startTime = null;
            }
        }
        get duration() {
            return this.buf.duration;
        }
        onended() {
            this.ended();
        }
    }
    class PCMSoundMixLR extends PCMSound {
        constructor(dst, lbuf, rbuf) {
            super(dst);
            this.endCount = 0;
            this.lsrc = this.context.createBufferSource();
            this.rsrc = this.context.createBufferSource();
            this.lsrc.buffer = lbuf;
            this.rsrc.buffer = rbuf;
            let merger = this.context.createChannelMerger(2);
            merger.connect(this.gain);
            this.lsrc.connect(merger, 0, 0);
            this.rsrc.connect(merger, 0, 1);
            this.lsrc.onended = this.rsrc.onended = this.onended.bind(this);
        }
        start(loop) {
            if (loop !== 1)
                console.warn('PCMSoundMixLR: loop is not supported ' + loop);
            this.lsrc.start();
            this.rsrc.start();
            this.startTime = this.context.currentTime;
        }
        stop() {
            if (this.startTime) {
                this.lsrc.stop();
                this.rsrc.stop();
                this.startTime = null;
            }
        }
        get duration() {
            return Math.max(this.lsrc.buffer.duration, this.rsrc.buffer.duration);
        }
        onended() {
            this.endCount++;
            if (this.endCount === 2)
                this.ended();
        }
    }
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
var xsystem35;
(function (xsystem35) {
    class ToolBar {
        constructor() {
            this.toolbar = $('#toolbar');
            this.handler = $('#toolbar-handler');
            $('#screenshot-button').addEventListener('click', this.saveScreenshot.bind(this));
        }
        setCloseable() {
            this.handler.addEventListener('click', this.open.bind(this));
            $('#toolbar-close-button').addEventListener('click', this.close.bind(this));
            this.toolbar.classList.add('closeable');
            this.close();
        }
        open() {
            this.toolbar.classList.remove('closed');
        }
        close() {
            this.toolbar.classList.add('closed');
        }
        async saveScreenshot() {
            let pixels = _sdl_getDisplaySurface();
            let canvas = document.createElement('canvas');
            canvas.width = Module.canvas.width;
            canvas.height = Module.canvas.height;
            let ctx = canvas.getContext('2d');
            let image = ctx.createImageData(canvas.width, canvas.height);
            let buffer = image.data;
            let num = image.data.length;
            for (let dst = 0; dst < num; dst += 4) {
                buffer[dst] = Module.HEAPU8[pixels + 2];
                buffer[dst + 1] = Module.HEAPU8[pixels + 1];
                buffer[dst + 2] = Module.HEAPU8[pixels];
                buffer[dst + 3] = 0xff;
                pixels += 4;
            }
            ctx.putImageData(image, 0, 0);
            ga('send', 'event', 'Toolbar', 'Screenshot');
            let url;
            if (canvas.toBlob) {
                let blob = await new Promise((resolve) => canvas.toBlob(resolve));
                url = URL.createObjectURL(blob);
            }
            else if (canvas.msToBlob) { // Edge
                let blob = canvas.msToBlob();
                navigator.msSaveBlob(blob, getScreenshotFilename());
                return;
            }
            else { // Safari
                url = canvas.toDataURL();
            }
            let elem = document.createElement('a');
            elem.setAttribute('download', getScreenshotFilename());
            elem.setAttribute('href', url);
            elem.setAttribute('target', '_blank'); // Unless this, iOS safari replaces current page
            document.body.appendChild(elem);
            elem.click();
            setTimeout(() => { document.body.removeChild(elem); }, 5000);
        }
    }
    xsystem35.ToolBar = ToolBar;
    function getScreenshotFilename() {
        let now = new Date();
        let MM = ('0' + (now.getMonth() + 1)).slice(-2);
        let DD = ('0' + now.getDate()).slice(-2);
        let hh = ('0' + now.getHours()).slice(-2);
        let mm = ('0' + now.getMinutes()).slice(-2);
        return 'Screenshot-' + now.getFullYear() + MM + DD + '-' + hh + mm + '.png';
    }
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="config.ts" />
/// <reference path="loader.ts" />
/// <reference path="settings.ts" />
/// <reference path="zoom.ts" />
/// <reference path="volume.ts" />
/// <reference path="cdda.ts" />
/// <reference path="midi.ts" />
/// <reference path="audio.ts" />
/// <reference path="toolbar.ts" />
var xsystem35;
(function (xsystem35) {
    const FontGothic = 'MTLc3m.ttf';
    const FontMincho = 'mincho.otf';
    xsystem35.xsys35rc = [
        'font_device: ttf',
        'ttfont_mincho: ' + FontMincho,
        'ttfont_gothic: ' + FontGothic, '',
    ].join('\n');
    xsystem35.urlParams = new URLSearchParams(location.search.slice(1));
    class System35Shell {
        constructor() {
            this.status = document.getElementById('status');
            this.persistRequested = false;
            this.initModule();
            window.onerror = (message, url, line, column, error) => {
                gaException({ type: 'onerror', message, url, line, column }, true);
                this.addToast('エラーが発生しました。', 'error');
                window.onerror = null;
            };
            window.addEventListener('unhandledrejection', (evt) => {
                let reason = evt.reason;
                console.log(reason);
                if (reason instanceof Error) {
                    let { name, message, stack } = reason;
                    gaException({ type: 'rejection', name, message, stack }, true);
                }
                else {
                    gaException({ type: 'rejection', name: reason.constructor.name, reason }, true);
                }
                // this.addToast('エラーが発生しました。', 'error');
            });
            this.loader = new xsystem35.Loader(this);
            this.volumeControl = new xsystem35.VolumeControl();
            xsystem35.cdPlayer = new xsystem35.CDPlayer(this.loader, this.volumeControl);
            xsystem35.midiPlayer = new xsystem35.MIDIPlayer();
            this.zoom = new xsystem35.ZoomManager();
            this.toolbar = new xsystem35.ToolBar();
            xsystem35.audio = new xsystem35.AudioManager(this.volumeControl.audioNode());
            xsystem35.settings = new xsystem35.Settings();
        }
        initModule() {
            let fsReady;
            xsystem35.fileSystemReady = new Promise((resolve) => { fsReady = resolve; });
            let idbfsReady;
            xsystem35.saveDirReady = new Promise((resolve) => { idbfsReady = resolve; });
            Module.arguments = [];
            for (let [name, val] of xsystem35.urlParams) {
                if (name.startsWith('-')) {
                    Module.arguments.push(name);
                    if (val)
                        Module.arguments.push(val);
                }
            }
            Module.print = Module.printErr = console.log.bind(console);
            Module.canvas = document.getElementById('canvas');
            Module.preRun = [
                () => { Module.addRunDependency('gameFiles'); },
                fsReady,
                function loadFont() {
                    FS.createPreloadedFile('/', FontGothic, 'fonts/' + FontGothic, true, false);
                },
                function prepareSaveDir() {
                    FS.mkdir('/save');
                    FS.mount(IDBFS, {}, '/save');
                    Module.addRunDependency('syncfs');
                    FS.syncfs(true, (err) => {
                        importSaveDataFromLocalFileSystem().then(() => {
                            Module.removeRunDependency('syncfs');
                            idbfsReady(FS);
                        });
                    });
                },
            ];
        }
        loadModule(name) {
            $('#loader').classList.add('module-loading');
            let src = name + (this.shouldUseWasm() ? '.js' : '.asm.js');
            let script = document.createElement('script');
            script.src = src;
            script.onerror = () => {
                ga('send', 'event', 'Game', 'ModuleLoadFailed', src);
                this.addToast(src + 'の読み込みに失敗しました。リロードしてください。', 'error');
            };
            document.body.appendChild(script);
            let endMeasure = startMeasure('ModuleLoad', 'Module load', src);
            return xsystem35.fileSystemReady.then(() => {
                endMeasure();
                $('#loader').hidden = true;
                document.body.classList.add('bgblack-fade');
                this.toolbar.setCloseable();
            });
        }
        shouldUseWasm() {
            if (typeof WebAssembly !== 'object')
                return false;
            let param = xsystem35.urlParams.get('wasm');
            if (param)
                return param !== '0';
            if (isIOSVersionBetween('11.2.2', '11.3')) {
                // Disable wasm on iOS 11.2.[2-] to workaround WebKit bug
                // https://bugs.webkit.org/show_bug.cgi?id=181781
                ga('send', 'event', 'Game', 'WasmDisabled');
                return false;
            }
            return true;
        }
        loaded(hasMidi) {
            if (hasMidi)
                xsystem35.midiPlayer.init(this.volumeControl.audioNode());
            $('#xsystem35').hidden = false;
            document.body.classList.add('game');
            $('#toolbar').classList.remove('before-game-start');
            window.onbeforeunload = this.onBeforeUnload.bind(this);
            setTimeout(() => {
                if (xsystem35.config.antialias)
                    Module.arguments.push('-antialias');
                Module.removeRunDependency('gameFiles');
            }, 0);
        }
        onBeforeUnload(e) {
            if (xsystem35.config.unloadConfirmation) {
                e.returnValue = 'セーブしていないデータは失われます。';
                this.volumeControl.suspendForModalDialog();
            }
        }
        windowSizeChanged() {
            this.zoom.handleZoom();
            this.zoom.recalcAspectRatio();
        }
        setWindowTitle(title) {
            let colon = title.indexOf(':');
            if (colon !== -1) {
                title = title.slice(colon + 1);
                $('.navbar-brand').textContent = title;
                ga('set', 'dimension1', title);
                ga('send', 'event', 'Game', 'GameStart', title);
            }
        }
        inputString(title, initialValue, maxLength) {
            title += ' (全角' + maxLength + '文字まで)';
            let result = window.prompt(title, initialValue);
            if (result) {
                result = result.substring(0, maxLength);
            }
            return result;
        }
        quit() {
            this.addToast('終了しました。');
            ga('send', 'event', 'Game', 'GameEnd');
            window.onbeforeunload = null;
        }
        addToast(msg, type) {
            let container = $('.toast-container');
            let div = document.createElement('div');
            div.classList.add('toast');
            if (type)
                div.classList.add('toast-' + type);
            if (typeof msg === 'string')
                div.innerText = msg;
            else
                div.appendChild(msg);
            let btn = document.createElement('button');
            btn.setAttribute('class', 'btn btn-clear float-right');
            function dismiss() { if (div.parentNode === container)
                container.removeChild(div); }
            btn.addEventListener('click', dismiss);
            let timeout = type ? { success: 5000, warning: 10000, error: null }[type] : 5000;
            if (timeout)
                setTimeout(dismiss, timeout);
            div.insertBefore(btn, div.firstChild);
            container.insertBefore(div, container.firstChild);
            return div;
        }
        syncfs(timeout = 100) {
            window.clearTimeout(this.fsyncTimer);
            this.fsyncTimer = window.setTimeout(() => {
                FS.syncfs(false, (err) => {
                    if (err)
                        console.log('FS.syncfs error: ', err);
                });
            }, timeout);
            this.persistStorage();
        }
        async persistStorage() {
            if (this.persistRequested || !(navigator.storage && navigator.storage.persist))
                return;
            this.persistRequested = true;
            if (await navigator.storage.persisted())
                return;
            let result = await navigator.storage.persist();
            ga('send', 'event', 'Game', 'StoragePersist', result ? 'granted' : 'refused');
        }
    }
    xsystem35.System35Shell = System35Shell;
    async function importSaveDataFromLocalFileSystem() {
        function requestFileSystem(type, size) {
            return new Promise((resolve, reject) => window.webkitRequestFileSystem(type, size, resolve, reject));
        }
        function getDirectory(dir, path) {
            return new Promise((resolve, reject) => dir.getDirectory(path, {}, resolve, reject));
        }
        function readEntries(reader) {
            return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        }
        function fileOf(entry) {
            return new Promise((resolve, reject) => entry.file(resolve, reject));
        }
        if (FS.readdir('/save').length > 2) // Are there any entries other than . and ..?
            return;
        if (!window.webkitRequestFileSystem)
            return;
        try {
            let fs = await requestFileSystem(self.PERSISTENT, 0);
            let savedir = (await getDirectory(fs.root, 'save')).createReader();
            let entries = [];
            while (true) {
                let results = await readEntries(savedir);
                if (!results.length)
                    break;
                for (let e of results) {
                    if (e.isFile && e.name.toLowerCase().endsWith('.asd'))
                        entries.push(e);
                }
            }
            if (entries.length && window.confirm('鬼畜王 on Chrome のセーブデータを引き継ぎますか?')) {
                for (let e of entries) {
                    let content = await readFileAsArrayBuffer(await fileOf(e));
                    FS.writeFile('/save/' + e.name, new Uint8Array(content), { encoding: 'binary' });
                }
                xsystem35.shell.syncfs(0);
                ga('send', 'event', 'Game', 'SaveDataImported');
            }
        }
        catch (err) {
        }
    }
    xsystem35.importSaveDataFromLocalFileSystem = importSaveDataFromLocalFileSystem;
    let mincho_loaded = false;
    function load_mincho_font() {
        if (mincho_loaded)
            return Promise.resolve(xsystem35.Status.OK);
        mincho_loaded = true;
        return new Promise((resolve) => {
            console.log('loading mincho font');
            let endMeasure = startMeasure('FontLoad', 'Font load', FontMincho);
            readAsync('fonts/' + FontMincho, (buf) => {
                endMeasure();
                FS.writeFile(FontMincho, new Uint8Array(buf), { encoding: 'binary' });
                resolve(xsystem35.Status.OK);
            }, () => {
                resolve(xsystem35.Status.NG);
            });
        });
    }
    xsystem35.load_mincho_font = load_mincho_font;
    function loadPolyfills() {
        if (typeof TextDecoder === 'undefined') {
            const scripts = [
                'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding-indexes.js',
                'https://cdn.jsdelivr.net/gh/inexorabletash/text-encoding@3f330964/lib/encoding.js'
            ];
            for (let src of scripts)
                loadScript(src);
        }
    }
    xsystem35.loadPolyfills = loadPolyfills;
    window.addEventListener('load', loadPolyfills);
    xsystem35.shell = new System35Shell();
})(xsystem35 || (xsystem35 = {}));
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js');
    });
}
window.addEventListener('beforeinstallprompt', (e) => {
    e.userChoice.then((choiceResult) => {
        ga('send', 'event', 'App', 'InstallPrompt', choiceResult.outcome);
    });
});
