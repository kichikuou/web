// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

export interface Reader {
    readSector(sector: number): Promise<ArrayBuffer>;
    readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]>;
    maxTrack(): number;
    extractTrack(track: number): Promise<Blob>;
}

export async function createReader(img: File, metadata?: File): Promise<Reader> {
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

export function createWaveFile(sampleRate: number, channels: number, dataSize: number, chunks: BlobPart[]): Blob {
    let headerBuf = new ArrayBuffer(44);
    let header = new DataView(headerBuf);
    header.setUint32(0, 0x52494646, false); // 'RIFF'
    header.setUint32(4, dataSize + 36, true); // filesize - 8
    header.setUint32(8, 0x57415645, false); // 'WAVE'
    header.setUint32(12, 0x666D7420, false); // 'fmt '
    header.setUint32(16, 16, true); // size of fmt chunk
    header.setUint16(20, 1, true); // PCM format
    header.setUint16(22, channels, true); // stereo
    header.setUint32(24, sampleRate, true); // sampling rate
    header.setUint32(28, sampleRate * channels * 2, true); // bytes/sec
    header.setUint16(32, channels * 2, true); // block size
    header.setUint16(34, 16, true); // bit/sample
    header.setUint32(36, 0x64617461, false); // 'data'
    header.setUint32(40, dataSize, true); // data size
    chunks.unshift(headerBuf);
    return new Blob(chunks, { type: 'audio/wav' });
}
