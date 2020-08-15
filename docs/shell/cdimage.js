// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { readFileAsArrayBuffer, readFileAsText } from './util.js';
import { openFileInput } from './widgets.js';
export class ISO9660FileSystem {
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
var VDType;
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
        return undefined;
    }
    escapeSequence() {
        return ASCIIArrayToString(new Uint8Array(this.buf, 88, 32)).trim();
    }
    rootDirEnt(decoder) {
        return new DirEnt(this.buf, 156, decoder);
    }
}
export class DirEnt {
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
export async function createReader(img, metadata) {
    if (img.name.endsWith('.iso')) {
        return new IsoReader(img);
    }
    else if (!metadata) {
        throw new Error('No metadata file');
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
    reloadImage() {
        return openFileInput().then((file) => {
            this.image = file;
        });
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
        this.tracks = [];
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
        let currentTrack = null;
        for (let line of lines) {
            line = line.trim();
            let match = line.match(/\[TRACK ([0-9]+)\]/);
            if (match) {
                currentTrack = Number(match[1]);
                this.tracks[currentTrack] = { isAudio: false, index: [] };
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
            throw new Error('Invalid track ' + track);
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
var MdsTrackMode;
(function (MdsTrackMode) {
    MdsTrackMode[MdsTrackMode["Audio"] = 169] = "Audio";
    MdsTrackMode[MdsTrackMode["Mode1"] = 170] = "Mode1";
})(MdsTrackMode || (MdsTrackMode = {}));
class MdfMdsReader extends ImageReaderBase {
    constructor(mdf) {
        super(mdf);
        this.tracks = [];
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
            throw new Error('Invalid track ' + track);
        let size = this.tracks[track].sectors * 2352;
        let chunks = await this.readSequential(this.tracks[track].offset, size, this.tracks[track].sectorSize, 2352, 0);
        return new Blob([createWaveHeader(size)].concat(chunks), { type: 'audio/wav' });
    }
}
function ASCIIArrayToString(buffer) {
    return String.fromCharCode.apply(null, buffer);
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
