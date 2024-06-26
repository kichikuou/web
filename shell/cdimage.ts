// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { createWaveFile } from './util.js';

export class ISO9660FileSystem {
    private decoder: TextDecoder;

    static async create(sectorReader: Reader): Promise<ISO9660FileSystem> {
        let best_vd: VolumeDescriptor | null = null;
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

    private constructor(private sectorReader: Reader, private vd: VolumeDescriptor) {
        this.decoder = new TextDecoder(vd.encoding());
    }

    volumeLabel(): string {
        return this.vd.volumeLabel(this.decoder);
    }

    rootDir(): DirEnt {
        return this.vd.rootDirEnt(this.decoder);
    }

    async getDirEnt(name: string, parent: DirEnt): Promise<DirEnt | null> {
        name = name.toLowerCase();
        for (let e of await this.readDir(parent)) {
            if (e.name.toLowerCase() === name)
                return e;
        }
        return null;
    }

    async readDir(dirent: DirEnt): Promise<DirEnt[]> {
        let sector = dirent.sector;
        let position = 0;
        let length = dirent.size;
        let entries: DirEnt[] = [];
        let buf: ArrayBuffer;
        while (position < length) {
            if (position === 0)
                buf = await this.sectorReader.readSector(sector);
            let child = new DirEnt(buf!, position, this.decoder);
            if (child.length === 0) {
                // Padded end of sector
                position = 2048;
            } else {
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

    readFile(dirent: DirEnt): Promise<Uint8Array[]> {
        return this.sectorReader.readSequentialSectors(dirent.sector, dirent.size);
    }
}

enum VDType {
    Primary = 1,
    Supplementary = 2,
    Terminator = 255
}

class VolumeDescriptor {
    private view: DataView;
    constructor(private buf: ArrayBuffer) {
        this.view = new DataView(buf);
        if (ASCIIArrayToString(new Uint8Array(this.buf, 1, 5)) !== 'CD001')
            throw new Error('Not a valid CD image');
    }
    get type(): number {
        return this.view.getUint8(0);
    }
    volumeLabel(decoder: TextDecoder): string {
        return decoder.decode(new DataView(this.buf, 40, 32)).trim();
    }
    encoding(): string | undefined {
        if (this.type === VDType.Primary)
            return 'shift_jis';
        if (this.escapeSequence().match(/%\/[@CE]/))
            return 'utf-16be';  // Joliet
        return undefined;
    }
    escapeSequence(): string {
        return ASCIIArrayToString(new Uint8Array(this.buf, 88, 32)).trim();
    }
    rootDirEnt(decoder: TextDecoder): DirEnt {
        return new DirEnt(this.buf, 156, decoder);
    }
}

export class DirEnt {
    private view: DataView;
    constructor(private buf: ArrayBuffer, private offset: number, private decoder: TextDecoder) {
        this.view = new DataView(buf, offset);
    }
    get length(): number {
        return this.view.getUint8(0);
    }
    get sector(): number {
        return this.view.getUint32(2, true);
    }
    get size(): number {
        return this.view.getUint32(10, true);
    }
    get isDirectory(): boolean {
        return (this.view.getUint8(25) & 2) !== 0;
    }
    get name(): string {
        let len = this.view.getUint8(32);
        let name = new DataView(this.buf, this.offset + 33, len)
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

export interface Reader {
    readSector(sector: number): Promise<ArrayBuffer>;
    readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]>;
    maxTrack(): number;
    extractTrack(track: number): Promise<Blob>;
}

export async function createReader(img: File, metadata?: File) {
    if (img.name.toLowerCase().endsWith('.iso')) {
        return new IsoReader(img);
    } else if (!metadata) {
        throw new Error('No metadata file');
    } else if (metadata.name.toLowerCase().endsWith('.cue')) {
        let reader = new ImgCueReader(img);
        await reader.parseCue(metadata);
        return reader;
    } else if (metadata.name.toLowerCase().endsWith('.ccd')) {
        let reader = new ImgCueReader(img);
        await reader.parseCcd(metadata);
        return reader;
    } else {
        let reader = new MdfMdsReader(img);
        await reader.parseMds(metadata);
        return reader;
    }
}

class IsoReader implements Reader {
    constructor(public image: File) { }

    readSector(sector: number): Promise<ArrayBuffer> {
        return this.image.slice(sector * 2048, (sector + 1) * 2048).arrayBuffer();
    }

    async readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]> {
        let start = startSector * 2048;
        let buf = await this.image.slice(start, start + length).arrayBuffer();
        return [new Uint8Array(buf)];
    }

    maxTrack(): number {
        return 1;
    }

    extractTrack(track: number): Promise<Blob> {
        throw 'not implemented';
    }
}

async function readSequential(
    image: File,
    startOffset: number,
    bytesToRead: number,
    blockSize: number,
    sectorSize: number,
    sectorOffset: number
): Promise<Uint8Array[]> {
    let sectors = Math.ceil(bytesToRead / sectorSize);
    let buf = await image.slice(startOffset, startOffset + sectors * blockSize).arrayBuffer();
    let bufs: Uint8Array[] = [];
    for (let i = 0; i < sectors; i++) {
        bufs.push(new Uint8Array(buf, i * blockSize + sectorOffset, Math.min(bytesToRead, sectorSize)));
        bytesToRead -= sectorSize;
    }
    return bufs;
}

class ImgCueReader implements Reader {
    private tracks: Array<{ isAudio: boolean; index: number[]; }> = [];

    constructor(private img: File) {}

    readSector(sector: number): Promise<ArrayBuffer> {
        let start = sector * 2352 + 16;
        let end = start + 2048;
        return this.img.slice(start, end).arrayBuffer();
    }

    readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]> {
        return readSequential(this.img, startSector * 2352, length, 2352, 2048, 16);
    }

    async parseCue(cueFile: File) {
        let lines = (await cueFile.text()).split('\n');
        let currentTrack: number | null = null;
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

    async parseCcd(ccdFile: File) {
        let lines = (await ccdFile.text()).split('\n');
        let currentTrack: number | null = null;
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

    maxTrack(): number {
        return this.tracks.length - 1;
    }

    async extractTrack(track: number): Promise<Blob> {
        if (!this.tracks[track] || !this.tracks[track].isAudio)
            throw new Error('Invalid track ' + track);

        let start = this.tracks[track].index[1] * 2352;
        let end: number;
        if (this.tracks[track + 1]) {
            let index = this.tracks[track + 1].index[0] || this.tracks[track + 1].index[1];
            end = index * 2352;
        } else {
            end = this.img.size;
        }
        return createWaveFile(44100, 2, end - start, [this.img.slice(start, end)]);
    }

    private indexToSector(index: string): number {
        let msf = index.split(':').map(Number);
        return msf[0] * 60 * 75 + msf[1] * 75 + msf[2];
    }
}

enum MdsTrackMode { Audio = 0xa9, Mode1 = 0xaa }

class MdfMdsReader implements Reader {
    private tracks: Array<{ mode: number; sectorSize: number; offset: number; sectors: number; }> = [];

    constructor(private mdf: File) {}

    async parseMds(mdsFile: File) {
        let buf = await mdsFile.arrayBuffer();

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

    readSector(sector: number): Promise<ArrayBuffer> {
        let start = sector * this.tracks[1].sectorSize + 16;
        let end = start + 2048;
        return this.mdf.slice(start, end).arrayBuffer();
    }

    readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]> {
        let track = this.tracks[1];
        return readSequential(
            this.mdf, track.offset + startSector * track.sectorSize, length,
            track.sectorSize, 2048, 16);
    }

    maxTrack(): number {
        return this.tracks.length - 1;
    }

    async extractTrack(track: number): Promise<Blob> {
        if (!this.tracks[track] || this.tracks[track].mode !== MdsTrackMode.Audio)
            throw new Error('Invalid track ' + track);

        let size = this.tracks[track].sectors * 2352;
        let chunks = await readSequential(
            this.mdf, this.tracks[track].offset, size,
            this.tracks[track].sectorSize, 2352, 0);
        return createWaveFile(44100, 2, size, chunks);
    }
}

function ASCIIArrayToString(buffer: Uint8Array): string {
    return String.fromCharCode.apply(null, buffer as any);
}
