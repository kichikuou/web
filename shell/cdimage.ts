// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

export interface Reader {
    readSector(sector: number): Promise<ArrayBuffer>;
    readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]>;
    hasAudioTrack(): boolean;
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

    hasAudioTrack(): boolean {
        return false;
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
): Promise<Uint8Array<ArrayBuffer>[]> {
    let sectors = Math.ceil(bytesToRead / sectorSize);
    let buf = await image.slice(startOffset, startOffset + sectors * blockSize).arrayBuffer();
    if (sectorSize === blockSize) {
        return [new Uint8Array(buf, 0, bytesToRead)];
    }
    let bufs: Uint8Array<ArrayBuffer>[] = [];
    for (let i = 0; i < sectors; i++) {
        bufs.push(new Uint8Array(buf, i * blockSize + sectorOffset, Math.min(bytesToRead, sectorSize)));
        bytesToRead -= sectorSize;
    }
    return bufs;
}

interface TrackInfo {
    isAudio: boolean;
    offset: number;
    blockSize: number;
    blockOffset: number;
    startSector: number;
    numSectors: number;
}

interface CueTrack {
    isAudio: boolean;
    blockSize: number;
    blockOffset: number;
    index: number[];
}

class ImgCueReader implements Reader {
    private tracks: Array<TrackInfo | undefined> = [];

    constructor(private img: File) {}

    async readSector(sector: number): Promise<ArrayBuffer> {
        const track = this.findTrack(sector);
        if (!track) {
            throw new Error('Invalid sector ' + sector);
        }
        let offset = track.offset + (sector - track.startSector) * track.blockSize + track.blockOffset;
        return await this.img.slice(offset, offset + 2048).arrayBuffer();
    }

    async readSequentialSectors(startSector: number, length: number): Promise<Uint8Array[]> {
        const track = this.findTrack(startSector);
        if (!track) {
            throw new Error('Invalid sector ' + startSector);
        }
        let offset = track.offset + (startSector - track.startSector) * track.blockSize;
        return readSequential(this.img, offset, length, track.blockSize, 2048, track.blockOffset);
    }

    async parseCue(cueFile: File) {
        let lines = (await cueFile.text()).split('\n');
        let currentTrack: number | null = null;
        const tracks: CueTrack[] = [];
        for (let line of lines) {
            let fields = line.trim().split(/\s+/);
            switch (fields[0]) {
                case 'TRACK':
                    currentTrack = Number(fields[1]);
                    switch (fields[2]) {
                        case 'MODE1/2048':
                            tracks[currentTrack] = { isAudio: false, blockSize: 2048, blockOffset: 0, index: [] };
                            break;
                        case 'MODE1/2352':
                            tracks[currentTrack] = { isAudio: false, blockSize: 2352, blockOffset: 16, index: [] };
                            break;
                        case 'AUDIO':
                            tracks[currentTrack] = { isAudio: true, blockSize: 2352, blockOffset: 0, index: [] };
                            break;
                        default:
                            throw new Error(`${cueFile.name}: Unsupported track mode "${fields[2]}"`);
                    }
                    break;
                case 'INDEX':
                    if (currentTrack)
                        tracks[currentTrack].index[Number(fields[1])] = this.indexToSector(fields[2]);
                    break;
                default:
                    // Do nothing
            }
        }
        this.makeTrackInfo(tracks);
    }

    async parseCcd(ccdFile: File) {
        let lines = (await ccdFile.text()).split('\n');
        let currentTrack: number | null = null;
        const tracks: CueTrack[] = [];
        for (let line of lines) {
            line = line.trim();
            let match = line.match(/\[TRACK ([0-9]+)\]/);
            if (match) {
                currentTrack = Number(match[1]);
                tracks[currentTrack] = { isAudio: false, blockSize: 2352, blockOffset: 16, index: [] };
                continue;
            }
            if (!currentTrack)
                continue;
            let keyval = line.split(/=/);
            switch (keyval[0]) {
                case 'MODE':
                    if (keyval[1] === '0') {
                        tracks[currentTrack].isAudio = true;
                        tracks[currentTrack].blockOffset = 0;
                    }
                    break;
                case 'INDEX 0':
                    tracks[currentTrack].index[0] = Number(keyval[1]);
                    break;
                case 'INDEX 1':
                    tracks[currentTrack].index[1] = Number(keyval[1]);
                    break;
                default:
                    // Do nothing
            }
        }
        this.makeTrackInfo(tracks);
    }

    private makeTrackInfo(cueTracks: CueTrack[]) {
        let offset = 0;
        let startSector = 0;
        for (let i = 1; i < cueTracks.length; i++) {
            const { isAudio, blockSize, blockOffset, index } = cueTracks[i];
            if (index[0]) {
                const gap = index[1] - index[0];
                startSector += gap;
                offset += gap * blockSize;
            }
            let numSectors = i + 1 < cueTracks.length
                ? (cueTracks[i + 1].index[0] || cueTracks[i + 1].index[1]) - index[1]
                : (this.img.size - offset) / blockSize;
            this.tracks[i] = { isAudio, offset, blockSize, blockOffset, startSector, numSectors };
            startSector += numSectors;
            offset += numSectors * blockSize;
        }
    }

    hasAudioTrack(): boolean {
        return this.tracks.some(track => track?.isAudio);
    }

    maxTrack(): number {
        return this.tracks.length - 1;
    }

    async extractTrack(trk: number): Promise<Blob> {
        const track = this.tracks[trk];
        if (!track || !track.isAudio)
            throw new Error('Invalid track ' + trk);

        const size = track.numSectors * track.blockSize;
        const blob = this.img.slice(track.offset, track.offset + size);
        return createWaveFile(44100, 2, size, [blob]);
    }

    private indexToSector(index: string): number {
        let msf = index.split(':').map(Number);
        return msf[0] * 60 * 75 + msf[1] * 75 + msf[2];
    }

    private findTrack(sector: number): TrackInfo | null {
        for (let track of this.tracks) {
            if (!track) continue;
            if (sector >= track.startSector && sector < track.startSector + track.numSectors) {
                return track;
            }
        }
        return null;
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

    hasAudioTrack(): boolean {
        return this.tracks.some(track => track?.mode === MdsTrackMode.Audio);
    }

    maxTrack(): number {
        return this.tracks.length - 1;
    }

    async extractTrack(trk: number): Promise<Blob> {
        const track = this.tracks[trk];
        if (!track || track.mode !== MdsTrackMode.Audio)
            throw new Error('Invalid track ' + trk);

        let size = track.sectors * 2352;
        let chunks = await readSequential(this.mdf, track.offset, size, track.sectorSize, 2352, 0);
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
