var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
let $ = document.querySelector.bind(document);
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
        if (err.code !== 'EEXIST')
            throw err;
    }
}
function isIOSVersionBetween(from, to) {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return from <= ver && ver < to;
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
        static create(sectorReader) {
            return __awaiter(this, void 0, void 0, function* () {
                let best_vd = null;
                for (let sector = 0x10;; sector++) {
                    let vd = new VolumeDescriptor(yield sectorReader.readSector(sector));
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
            });
        }
        volumeLabel() {
            return this.vd.volumeLabel(this.decoder);
        }
        rootDir() {
            return this.vd.rootDirEnt(this.decoder);
        }
        getDirEnt(name, parent) {
            return __awaiter(this, void 0, void 0, function* () {
                name = name.toLowerCase();
                for (let e of yield this.readDir(parent)) {
                    if (e.name.toLowerCase() === name)
                        return e;
                }
                return null;
            });
        }
        readDir(dirent) {
            return __awaiter(this, void 0, void 0, function* () {
                let sector = dirent.sector;
                let position = 0;
                let length = dirent.size;
                let entries = [];
                let buf;
                while (position < length) {
                    if (position === 0)
                        buf = yield this.sectorReader.readSector(sector);
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
            });
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
    function createReader(img, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            if (img.name.endsWith('.iso')) {
                return new IsoReader(img);
            }
            else if (metadata.name.endsWith('.cue')) {
                let reader = new ImgCueReader(img);
                yield reader.parseCue(metadata);
                return reader;
            }
            else if (metadata.name.endsWith('.ccd')) {
                let reader = new ImgCueReader(img);
                yield reader.parseCcd(metadata);
                return reader;
            }
            else {
                let reader = new MdfMdsReader(img);
                yield reader.parseMds(metadata);
                return reader;
            }
        });
    }
    CDImage.createReader = createReader;
    class ImageReaderBase {
        constructor(image) {
            this.image = image;
        }
        readSequential(startOffset, bytesToRead, blockSize, sectorSize, sectorOffset) {
            return __awaiter(this, void 0, void 0, function* () {
                let sectors = Math.ceil(bytesToRead / sectorSize);
                let blob = this.image.slice(startOffset, startOffset + sectors * blockSize);
                let buf = yield readFileAsArrayBuffer(blob);
                let bufs = [];
                for (let i = 0; i < sectors; i++) {
                    bufs.push(new Uint8Array(buf, i * blockSize + sectorOffset, Math.min(bytesToRead, sectorSize)));
                    bytesToRead -= sectorSize;
                }
                return bufs;
            });
        }
        resetImage(image) {
            this.image = image;
        }
    }
    class IsoReader extends ImageReaderBase {
        readSector(sector) {
            return readFileAsArrayBuffer(this.image.slice(sector * 2048, (sector + 1) * 2048));
        }
        readSequentialSectors(startSector, length) {
            return __awaiter(this, void 0, void 0, function* () {
                let start = startSector * 2048;
                let buf = yield readFileAsArrayBuffer(this.image.slice(start, start + length));
                return [new Uint8Array(buf)];
            });
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
        parseCue(cueFile) {
            return __awaiter(this, void 0, void 0, function* () {
                let lines = (yield readFileAsText(cueFile)).split('\n');
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
            });
        }
        parseCcd(ccdFile) {
            return __awaiter(this, void 0, void 0, function* () {
                let lines = (yield readFileAsText(ccdFile)).split('\n');
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
            });
        }
        maxTrack() {
            return this.tracks.length - 1;
        }
        extractTrack(track) {
            return __awaiter(this, void 0, void 0, function* () {
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
                    pcm = yield readFileAsArrayBuffer(pcm);
                }
                return new Blob([createWaveHeader(size), pcm], { type: 'audio/wav' });
            });
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
        parseMds(mdsFile) {
            return __awaiter(this, void 0, void 0, function* () {
                let buf = yield readFileAsArrayBuffer(mdsFile);
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
            });
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
        extractTrack(track) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.tracks[track] || this.tracks[track].mode !== MdsTrackMode.Audio)
                    return;
                let size = this.tracks[track].sectors * 2352;
                let chunks = yield this.readSequential(this.tracks[track].offset, size, this.tracks[track].sectorSize, 2352, 0);
                return new Blob([createWaveHeader(size)].concat(chunks), { type: 'audio/wav' });
            });
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
    function registerDataFile(fname, size, chunks) {
        let dev = FS.makedev(major, entryCount++);
        FS.registerDevice(dev, new NodeOps(size, chunks));
        FS.mkdev('/' + fname, dev);
    }
    xsystem35.registerDataFile = registerDataFile;
    class NodeOps {
        constructor(size, chunks) {
            this.size = size;
            let ptr = this.addr = Module.getMemory(size);
            for (let c of chunks) {
                Module.HEAPU8.set(c, ptr);
                ptr += c.byteLength;
            }
        }
        read(stream, buffer, offset, length, position) {
            let src = this.addr + position;
            length = Math.min(length, this.size - position);
            buffer.set(Module.HEAPU8.subarray(src, src + length), offset);
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
            return { ptr: this.addr, allocated: false };
        }
    }
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="cdimage.ts" />
/// <reference path="datafile.ts" />
var xsystem35;
(function (xsystem35) {
    class ImageLoader {
        constructor(shell) {
            this.shell = shell;
            this.installing = false;
            this.hasMidi = false;
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }
        getCDDA(track) {
            return this.imageReader.extractTrack(track);
        }
        reloadImage() {
            return openFileInput().then((file) => {
                this.imageReader.resetImage(file);
            });
        }
        handleFileSelect(evt) {
            let input = evt.target;
            let files = input.files;
            for (let i = 0; i < files.length; i++)
                this.setFile(files[i]);
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
            let files = evt.dataTransfer.files;
            for (let i = 0; i < files.length; i++)
                this.setFile(files[i]);
        }
        setFile(file) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.installing)
                    return;
                let name = file.name.toLowerCase();
                if (name.endsWith('.img') || name.endsWith('.mdf') || name.endsWith('.iso')) {
                    this.imageFile = file;
                    $('#imgReady').classList.remove('notready');
                    $('#imgReady').textContent = file.name;
                }
                else if (name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds')) {
                    this.metadataFile = file;
                    $('#cueReady').classList.remove('notready');
                    $('#cueReady').textContent = file.name;
                }
                else if (name.endsWith('.rar')) {
                    this.shell.addToast('展開前のrarファイルは読み込めません。', 'warning');
                }
                else {
                    this.shell.addToast(name + ' は認識できない形式です。', 'warning');
                }
                if (this.imageFile && (this.metadataFile || this.imageFile.name.toLowerCase().endsWith('.iso'))) {
                    this.installing = true;
                    try {
                        this.imageReader = yield CDImage.createReader(this.imageFile, this.metadataFile);
                        yield this.startLoad();
                    }
                    catch (err) {
                        ga('send', 'event', 'Loader', 'LoadFailed', err.message);
                        this.shell.addToast('インストールできません。認識できない形式です。', 'error');
                    }
                    this.installing = false;
                }
            });
        }
        startLoad() {
            return __awaiter(this, void 0, void 0, function* () {
                let isofs = yield CDImage.ISO9660FileSystem.create(this.imageReader);
                // this.walk(isofs, isofs.rootDir(), '/');
                let gamedata = yield this.findGameDir(isofs);
                if (!gamedata) {
                    ga('send', 'event', 'Loader', 'NoGamedataDir');
                    this.shell.addToast('インストールできません。イメージ内にGAMEDATAフォルダが見つかりません。', 'error');
                    return;
                }
                let isSystem3 = !!(yield isofs.getDirEnt('system3.exe', gamedata));
                $('#loader').classList.add('module-loading');
                yield xsystem35.shell.loadModule(isSystem3 ? 'system3' : 'xsystem35');
                let startTime = performance.now();
                let aldFiles = [];
                for (let e of yield isofs.readDir(gamedata)) {
                    if (isSystem3) {
                        if (!e.name.toLowerCase().endsWith('.dat'))
                            continue;
                    }
                    else {
                        if (e.name.match(/^\.|\.(exe|dll|txt|ini)$/i))
                            continue;
                        if (e.name.toLowerCase().endsWith('.ald'))
                            aldFiles.push(e.name);
                    }
                    let chunks = yield isofs.readFile(e);
                    xsystem35.registerDataFile(e.name, e.size, chunks);
                }
                if (isSystem3) {
                    let savedir = yield this.saveDir(isofs);
                    Module.arguments.push('-savedir', savedir + '/');
                    xsystem35.saveDirReady.then(() => { mkdirIfNotExist(savedir); });
                }
                else {
                    FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
                    FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
                }
                ga('send', 'timing', 'Image load', this.imageFile.name, Math.round(performance.now() - startTime));
                this.shell.loaded();
            });
        }
        findGameDir(isofs) {
            return __awaiter(this, void 0, void 0, function* () {
                for (let e of yield isofs.readDir(isofs.rootDir())) {
                    if (e.isDirectory) {
                        if (e.name.toLowerCase() === 'gamedata' || (yield isofs.getDirEnt('system3.exe', e)))
                            return e;
                    }
                    if (e.name.toLowerCase() === 'system3.exe')
                        return isofs.rootDir();
                }
                return null;
            });
        }
        saveDir(isofs) {
            return __awaiter(this, void 0, void 0, function* () {
                let dirname = isofs.volumeLabel();
                if (!dirname) {
                    if (yield isofs.getDirEnt('prog.bat', isofs.rootDir())) {
                        dirname = 'ProG';
                    }
                    else if (yield isofs.getDirEnt('dps_all.bat', isofs.rootDir())) {
                        dirname = 'DPS_all';
                    }
                    else {
                        dirname = 'untitled';
                        ga('send', 'event', 'Loader', 'NoVolumeLabel');
                    }
                }
                return '/save/' + dirname;
            });
        }
        createGr(files) {
            const resourceType = {
                d: 'Data', g: 'Graphics', m: 'Midi', r: 'Resource', s: 'Scenario', w: 'Wave',
            };
            let basename;
            let lines = [];
            for (let name of files) {
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
        // For debug
        walk(isofs, dir, dirname) {
            return __awaiter(this, void 0, void 0, function* () {
                for (let e of yield isofs.readDir(dir)) {
                    if (e.name !== '.' && e.name !== '..') {
                        console.log(dirname + e.name);
                        if (e.isDirectory)
                            this.walk(isofs, e, dirname + e.name + '/');
                    }
                }
            });
        }
    }
    xsystem35.ImageLoader = ImageLoader;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="loader.ts" />
/// <reference path="datafile.ts" />
var xsystem35;
(function (xsystem35) {
    class FileLoader {
        constructor() {
            this.tracks = [];
            this.hasMidi = false;
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }
        getCDDA(track) {
            return Promise.resolve(this.tracks[track]);
        }
        reloadImage() {
            return Promise.resolve();
        }
        handleFileSelect(evt) {
            let input = evt.target;
            this.startLoad(input.files);
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
            this.startLoad(evt.dataTransfer.files);
        }
        startLoad(files) {
            return __awaiter(this, void 0, void 0, function* () {
                $('#loader').classList.add('module-loading');
                yield xsystem35.shell.loadModule('xsystem35');
                let aldFiles = [];
                for (let i = 0; i < files.length; i++) {
                    let f = files[i];
                    let match = /(\d+)\.(wav|mp3|ogg)$/.exec(f.name.toLowerCase());
                    if (match) {
                        this.tracks[Number(match[1])] = f;
                        continue;
                    }
                    let content = yield readFileAsArrayBuffer(f);
                    xsystem35.registerDataFile(f.name, f.size, [new Uint8Array(content)]);
                    aldFiles.push(f.name);
                }
                FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
                FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
                xsystem35.shell.loaded();
            });
        }
        createGr(files) {
            const resourceType = {
                d: 'Data', g: 'Graphics', m: 'Midi', r: 'Resource', s: 'Scenario', w: 'Wave',
            };
            let basename;
            let lines = [];
            for (let name of files) {
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
    xsystem35.FileLoader = FileLoader;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
var xsystem35;
(function (xsystem35) {
    class SaveDataManager {
        constructor() {
            if (window.FS)
                this.FSready = xsystem35.saveDirReady;
            if (!this.FSready)
                this.FSready = FSLib().saveDirReady;
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
        download() {
            return __awaiter(this, void 0, void 0, function* () {
                let zip = new JSZip();
                storeZip(yield this.FSready, '/save', zip.folder('save'));
                let blob = yield zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
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
            });
        }
        extract(file) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    let fs = yield this.FSready;
                    if (file.name.toLowerCase().endsWith('.asd')) {
                        addSaveFile(fs, '/save/' + file.name, yield readFileAsArrayBuffer(file));
                    }
                    else {
                        let zip = new JSZip();
                        let opts = {};
                        if (typeof TextDecoder !== 'undefined')
                            opts = { decodeFileName };
                        yield zip.loadAsync(yield readFileAsArrayBuffer(file), opts);
                        let entries = [];
                        zip.folder('save').forEach((path, z) => { entries.push(z); });
                        for (let z of entries) {
                            if (z.dir)
                                mkdirIfNotExist('/' + z.name.slice(0, -1), fs);
                            else
                                addSaveFile(fs, '/' + z.name, yield z.async('arraybuffer'));
                        }
                    }
                    yield new Promise((resolve, reject) => {
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
            });
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
    function decodeFileName(bytes) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        catch (err) {
            return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        }
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
        checkSaveData() {
            return __awaiter(this, void 0, void 0, function* () {
                if ($('#downloadSaveData').hasAttribute('disabled') &&
                    (yield this.saveDataManager.hasSaveData()))
                    $('#downloadSaveData').removeAttribute('disabled');
            });
        }
        downloadSaveData() {
            return __awaiter(this, void 0, void 0, function* () {
                this.saveDataManager.download();
            });
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
            if (screen.orientation && document.webkitExitFullscreen) {
                screen.orientation.addEventListener('change', () => {
                    if (screen.orientation.type.startsWith('landscape'))
                        document.documentElement.webkitRequestFullScreen();
                    else
                        document.webkitExitFullscreen();
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
    }
    xsystem35.VolumeControl = VolumeControl;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="volume.ts" />
var xsystem35;
(function (xsystem35) {
    class CDPlayer {
        constructor(loader, volumeControl) {
            this.loader = loader;
            this.audio = $('audio');
            // Volume control of <audio> is not supported in iOS
            this.audio.volume = 0.5;
            this.isVolumeSupported = this.audio.volume !== 1;
            this.blobCache = [];
            volumeControl.addEventListener(this.onVolumeChanged.bind(this));
            this.audio.volume = volumeControl.volume();
            this.audio.addEventListener('error', this.onAudioError.bind(this));
            this.removeUserGestureRestriction(true);
            if (!this.isVolumeSupported) {
                volumeControl.hideSlider();
                if (this.audio.volume === 0)
                    this.unmute = () => { };
            }
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        }
        play(track, loop) {
            this.currentTrack = track;
            if (this.unmute) {
                this.unmute = () => { this.play(track, loop); };
                return;
            }
            if (this.blobCache[track]) {
                this.startPlayback(this.blobCache[track], loop);
                return;
            }
            this.audio.currentTime = 0;
            this.loader.getCDDA(track).then((blob) => {
                if (blob) {
                    this.blobCache[track] = blob;
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
        onVisibilityChange() {
            if (document.hidden)
                this.blobCache = [];
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
            let clone = document.importNode($('#cdda-error').content, true);
            let toast = xsystem35.shell.addToast(clone, 'error');
            toast.querySelector('.cdda-reload-button').addEventListener('click', () => {
                this.loader.reloadImage().then(() => {
                    this.play(this.currentTrack, this.audio.loop ? 1 : 0);
                    toast.querySelector('.btn-clear').click();
                });
            });
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
        constructor(volumeControl) {
            this.volumeControl = volumeControl;
            this.playing = false;
            Module.addRunDependency('timidity');
            let script = document.createElement('script');
            script.src = '/timidity/timidity.js';
            script.onload = () => {
                Module.removeRunDependency('timidity');
                if (typeof (webkitAudioContext) !== 'undefined') {
                    this.context = new webkitAudioContext();
                    this.removeSafariGestureRestriction();
                }
                else {
                    this.context = new AudioContext();
                }
                this.masterGain = this.context.createGain();
                this.masterGain.connect(this.context.destination);
                this.volumeControl.addEventListener(this.onVolumeChanged.bind(this));
                this.masterGain.gain.value = this.volumeControl.volume();
                this.timidity = new Timidity(this.masterGain, '/timidity/');
                this.timidity.on('error', this.onError.bind(this));
                this.timidity.on('ended', this.onEnd.bind(this));
            };
            document.body.appendChild(script);
        }
        play(loop, data, datalen) {
            this.timidity.load(Module.HEAPU8.subarray(data, data + datalen));
            this.timidity.play();
            this.playing = true;
            // NOTE: `loop` is ignored.
        }
        stop() {
            this.playing = false;
            this.timidity.pause();
        }
        pause() {
            this.timidity.pause();
        }
        resume() {
            this.timidity.play();
        }
        getPosition() {
            return Math.round(this.timidity.currentTime * 1000);
        }
        setVolume(vol) {
        }
        getVolume() {
            return 100;
        }
        onError() {
            console.log('onError');
        }
        onEnd() {
            if (this.playing)
                this.timidity.play();
        }
        onVolumeChanged(evt) {
            this.masterGain.gain.value = evt.detail;
        }
        removeSafariGestureRestriction() {
            let handler = () => {
                let src = this.context.createBufferSource();
                src.buffer = this.context.createBuffer(1, 1, 22050);
                src.connect(this.context.destination);
                src.start();
                console.log('MIDI AudioContext unlocked');
                window.removeEventListener('touchend', handler);
                window.removeEventListener('mouseup', handler);
            };
            window.addEventListener('touchend', handler);
            window.addEventListener('mouseup', handler);
        }
    }
    xsystem35.MIDIPlayer = MIDIPlayer;
})(xsystem35 || (xsystem35 = {}));
// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
/// <reference path="util.ts" />
/// <reference path="volume.ts" />
var xsystem35;
(function (xsystem35) {
    class AudioManager {
        constructor(volumeControl) {
            this.volumeControl = volumeControl;
            this.slots = [];
            this.bufCache = [];
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
            if (typeof (webkitAudioContext) !== 'undefined') {
                this.context = new webkitAudioContext();
                this.isSafari = true;
                this.removeUserGestureRestriction();
            }
        }
        init() {
            if (!this.context)
                this.context = new AudioContext();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.volumeControl.addEventListener(this.onVolumeChanged.bind(this));
            this.masterGain.gain.value = this.volumeControl.volume();
        }
        removeUserGestureRestriction() {
            let handler = () => {
                let src = this.context.createBufferSource();
                src.buffer = this.context.createBuffer(1, 1, 22050);
                src.connect(this.context.destination);
                src.start();
                console.log('AudioContext unlocked');
                window.removeEventListener('touchend', handler);
                window.removeEventListener('mouseup', handler);
            };
            window.addEventListener('touchend', handler);
            window.addEventListener('mouseup', handler);
        }
        load(no) {
            let buf = this.getWave(no);
            if (!buf)
                return Promise.reject('Failed to open wave ' + no);
            let decoded;
            if (this.isSafari) {
                decoded = new Promise((resolve, reject) => {
                    this.context.decodeAudioData(buf, resolve, reject);
                });
            }
            else {
                decoded = this.context.decodeAudioData(buf);
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
            return EmterpreterAsync.handle((resume) => {
                this.pcm_stop(slot);
                if (this.bufCache[no]) {
                    this.slots[slot] = new PCMSoundSimple(this.masterGain, this.bufCache[no]);
                    return resume(() => xsystem35.Status.OK);
                }
                this.load(no).then((audioBuf) => {
                    this.slots[slot] = new PCMSoundSimple(this.masterGain, audioBuf);
                    resume(() => xsystem35.Status.OK);
                }).catch((err) => {
                    gaException({ type: 'PCM', err });
                    resume(() => xsystem35.Status.NG);
                });
            });
        }
        pcm_load_mixlr(slot, noL, noR) {
            return EmterpreterAsync.handle((resume) => {
                this.pcm_stop(slot);
                if (this.bufCache[noL] && this.bufCache[noR]) {
                    this.slots[slot] = new PCMSoundMixLR(this.masterGain, this.bufCache[noL], this.bufCache[noR]);
                    return resume(() => xsystem35.Status.OK);
                }
                let ps = [
                    this.bufCache[noL] ? Promise.resolve(this.bufCache[noL]) : this.load(noL),
                    this.bufCache[noR] ? Promise.resolve(this.bufCache[noR]) : this.load(noR),
                ];
                Promise.all(ps).then((bufs) => {
                    this.slots[slot] = new PCMSoundMixLR(this.masterGain, bufs[0], bufs[1]);
                    resume(() => xsystem35.Status.OK);
                }).catch((err) => {
                    gaException({ type: 'PCM', err });
                    resume(() => xsystem35.Status.NG);
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
            return EmterpreterAsync.handle((resume) => {
                if (!this.slots[slot] || !this.slots[slot].isPlaying())
                    return resume(() => xsystem35.Status.OK);
                this.slots[slot].end_callback = () => resume(() => xsystem35.Status.OK);
            });
        }
        onVisibilityChange() {
            if (document.hidden)
                this.bufCache = [];
        }
        onVolumeChanged(evt) {
            this.masterGain.gain.value = evt.detail;
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
            if (loop === 0)
                this.node.loop = true;
            else if (loop !== 1)
                console.warn('Unsupported PCM loop count ' + loop);
            this.node.start();
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
        saveScreenshot() {
            return __awaiter(this, void 0, void 0, function* () {
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
                    let blob = yield new Promise((resolve) => canvas.toBlob(resolve));
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
            });
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
/// <reference path="fileloader.ts" />
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
    class System35Shell {
        constructor() {
            this.status = document.getElementById('status');
            this.persistRequested = false;
            this.parseParams(location.search.slice(1));
            this.initModule();
            window.onerror = (message, url, line, column, error) => {
                gaException({ type: 'onerror', message, url, line, column }, true);
                this.addToast('エラーが発生しました。', 'error');
                window.onerror = null;
            };
            // Chrome only
            window.addEventListener('unhandledrejection', (evt) => {
                let err = evt.reason;
                console.log(err);
                let { message, stack } = err;
                gaException({ type: 'rejection', message, stack }, true);
                // this.addToast('エラーが発生しました。', 'error');
            });
            if (this.params.get('loader') === 'file')
                this.loader = new xsystem35.FileLoader();
            else
                this.loader = new xsystem35.ImageLoader(this);
            this.volumeControl = new xsystem35.VolumeControl();
            xsystem35.cdPlayer = new xsystem35.CDPlayer(this.loader, this.volumeControl);
            this.zoom = new xsystem35.ZoomManager();
            this.toolbar = new xsystem35.ToolBar();
            xsystem35.audio = new xsystem35.AudioManager(this.volumeControl);
            xsystem35.settings = new xsystem35.Settings();
        }
        parseParams(searchParams) {
            if (typeof URLSearchParams !== 'undefined') {
                this.params = new URLSearchParams(searchParams);
                return;
            }
            // For Edge
            this.params = new Map();
            if (window.location.search.length > 1) {
                for (let item of searchParams.split('&')) {
                    let [key, value] = item.split('=');
                    this.params.set(key, value);
                }
            }
        }
        initModule() {
            let fsReady;
            xsystem35.fileSystemReady = new Promise((resolve) => { fsReady = resolve; });
            let idbfsReady;
            xsystem35.saveDirReady = new Promise((resolve) => { idbfsReady = resolve; });
            Module.arguments = [];
            for (let [name, val] of this.params) {
                if (name.startsWith('-')) {
                    Module.arguments.push(name);
                    if (val)
                        Module.arguments.push(val);
                }
            }
            Module.print = Module.printErr = console.log.bind(console);
            Module.setWindowTitle = (title) => {
                let colon = title.indexOf(':');
                if (colon !== -1) {
                    title = title.slice(colon + 1);
                    $('.navbar-brand').textContent = title;
                    ga('set', 'dimension1', title);
                    ga('send', 'event', 'Game', 'GameStart', title);
                }
            };
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
            let src = name + (this.shouldUseWasm() ? '.js' : '.asm.js');
            let script = document.createElement('script');
            script.src = src;
            script.onerror = () => {
                ga('send', 'event', 'Game', 'ModuleLoadFailed', src);
                this.addToast(src + 'の読み込みに失敗しました。リロードしてください。', 'error');
            };
            document.body.appendChild(script);
            let start = performance.now();
            return xsystem35.fileSystemReady.then(() => {
                ga('send', 'timing', 'Module load', src, Math.round(performance.now() - start));
                $('#loader').hidden = true;
                document.body.classList.add('bgblack-fade');
                this.toolbar.setCloseable();
            });
        }
        shouldUseWasm() {
            if (typeof WebAssembly !== 'object')
                return false;
            let param = this.params.get('wasm');
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
        loaded() {
            if (this.loader.hasMidi)
                xsystem35.midiPlayer = new xsystem35.MIDIPlayer(this.volumeControl);
            xsystem35.audio.init();
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
            if (xsystem35.config.unloadConfirmation)
                e.returnValue = 'セーブしていないデータは失われます。';
        }
        windowSizeChanged() {
            this.zoom.handleZoom();
            this.zoom.recalcAspectRatio();
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
        persistStorage() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.persistRequested || !(navigator.storage && navigator.storage.persist))
                    return;
                this.persistRequested = true;
                if (yield navigator.storage.persisted())
                    return;
                let result = yield navigator.storage.persist();
                ga('send', 'event', 'Game', 'StoragePersist', result ? 'granted' : 'refused');
            });
        }
    }
    xsystem35.System35Shell = System35Shell;
    function importSaveDataFromLocalFileSystem() {
        return __awaiter(this, void 0, void 0, function* () {
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
                let fs = yield requestFileSystem(self.PERSISTENT, 0);
                let savedir = (yield getDirectory(fs.root, 'save')).createReader();
                let entries = [];
                while (true) {
                    let results = yield readEntries(savedir);
                    if (!results.length)
                        break;
                    for (let e of results) {
                        if (e.isFile && e.name.toLowerCase().endsWith('.asd'))
                            entries.push(e);
                    }
                }
                if (entries.length && window.confirm('鬼畜王 on Chrome のセーブデータを引き継ぎますか?')) {
                    for (let e of entries) {
                        let content = yield readFileAsArrayBuffer(yield fileOf(e));
                        FS.writeFile('/save/' + e.name, new Uint8Array(content), { encoding: 'binary' });
                    }
                    xsystem35.shell.syncfs(0);
                    ga('send', 'event', 'Game', 'SaveDataImported');
                }
            }
            catch (err) {
            }
        });
    }
    xsystem35.importSaveDataFromLocalFileSystem = importSaveDataFromLocalFileSystem;
    let mincho_loaded = false;
    function load_mincho_font() {
        if (mincho_loaded)
            return Promise.resolve(xsystem35.Status.OK);
        mincho_loaded = true;
        return new Promise((resolve) => {
            console.log('loading mincho font');
            let start = performance.now();
            Module.readAsync('fonts/' + FontMincho, (buf) => {
                ga('send', 'timing', 'Font load', FontMincho, Math.round(performance.now() - start));
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
            for (let src of scripts) {
                let e = document.createElement('script');
                e.src = src;
                e.async = true;
                document.body.appendChild(e);
            }
        }
    }
    xsystem35.loadPolyfills = loadPolyfills;
    window.addEventListener('load', loadPolyfills);
    xsystem35.shell = new System35Shell();
})(xsystem35 || (xsystem35 = {}));
